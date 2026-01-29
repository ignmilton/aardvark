import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { StorySegment, Story, Choice, User } from '@/database/entities';
import { CreateSegmentDto, UpdateSegmentDto, SegmentQueryDto, BulkUpdatePositionsDto } from './dto';
import { CollaborationMode } from '@aardvark/shared';
import * as sanitizeHtml from 'sanitize-html';

@Injectable()
export class SegmentsService {
  constructor(
    @InjectRepository(StorySegment)
    private readonly segmentRepository: Repository<StorySegment>,
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(Choice)
    private readonly choiceRepository: Repository<Choice>,
  ) {}

  /**
   * Create a new story segment
   */
  async create(createDto: CreateSegmentDto, authorId: string): Promise<StorySegment> {
    const story = await this.storyRepository.findOne({
      where: { id: createDto.storyId },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    // Check permissions based on collaboration mode
    const canCreate = await this.canCreateSegment(story, authorId);
    if (!canCreate.allowed) {
      throw new ForbiddenException(canCreate.reason);
    }

    // Calculate word count and read time
    const plainText = this.stripHtml(createDto.content);
    const wordCount = this.countWords(plainText);
    const estimatedReadTime = Math.ceil(wordCount / 200); // Assuming 200 WPM

    // Determine if this is the root segment
    const isRootSegment = !createDto.parentSegmentId;

    // If creating root segment, ensure story doesn't already have one
    if (isRootSegment) {
      const existingRoot = await this.segmentRepository.findOne({
        where: { storyId: createDto.storyId, isRootSegment: true },
      });
      if (existingRoot) {
        throw new BadRequestException('Story already has a root segment');
      }
    }

    // Validate parent segment exists
    const parentSegmentIds: string[] = [];
    if (createDto.parentSegmentId) {
      const parentSegment = await this.segmentRepository.findOne({
        where: { id: createDto.parentSegmentId, storyId: createDto.storyId },
      });
      if (!parentSegment) {
        throw new NotFoundException('Parent segment not found');
      }
      parentSegmentIds.push(createDto.parentSegmentId);
    }

    // Sanitize content to prevent XSS
    const sanitizedContent = this.sanitizeContent(createDto.content);

    // Create the segment
    const segment = this.segmentRepository.create({
      storyId: createDto.storyId,
      authorId,
      title: createDto.title || null,
      content: sanitizedContent,
      contentMarkdown: createDto.contentMarkdown || null,
      position: createDto.position || { x: 0, y: 0 },
      parentSegmentIds,
      isRootSegment,
      isEnding: createDto.isEnding || false,
      endingType: createDto.endingType || null,
      wordCount,
      estimatedReadTime,
      // Set approval status for collaborative stories
      approvalStatus: story.collaborationMode === CollaborationMode.MODERATED && story.authorId !== authorId
        ? 'pending'
        : null,
      submittedByUserId: story.authorId !== authorId ? authorId : null,
    });

    const savedSegment = await this.segmentRepository.save(segment);

    // Update story's root segment if this is the root
    if (isRootSegment) {
      await this.storyRepository.update(story.id, { rootSegmentId: savedSegment.id });
    }

    return savedSegment;
  }

  /**
   * Find segment by ID
   */
  async findById(id: string): Promise<StorySegment> {
    const segment = await this.segmentRepository.findOne({
      where: { id },
      relations: ['story', 'author', 'choices', 'choices.nextSegment'],
    });

    if (!segment) {
      throw new NotFoundException('Segment not found');
    }

    return segment;
  }

  /**
   * Find all segments for a story
   */
  async findByStory(storyId: string, includeUnapproved = false): Promise<StorySegment[]> {
    const queryBuilder = this.segmentRepository
      .createQueryBuilder('segment')
      .where('segment.storyId = :storyId', { storyId })
      .leftJoinAndSelect('segment.choices', 'choices')
      .orderBy('segment.createdAt', 'ASC');

    if (!includeUnapproved) {
      queryBuilder.andWhere(
        '(segment.approvalStatus IS NULL OR segment.approvalStatus = :approved)',
        { approved: 'approved' },
      );
    }

    return queryBuilder.getMany();
  }

  /**
   * Get story structure for visual editor
   */
  async getStoryStructure(storyId: string): Promise<{
    segments: StorySegment[];
    choices: Choice[];
    rootSegmentId: string | null;
  }> {
    const story = await this.storyRepository.findOne({ where: { id: storyId } });
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    const segments = await this.segmentRepository.find({
      where: { storyId },
      order: { createdAt: 'ASC' },
    });

    const segmentIds = segments.map((s) => s.id);
    const choices = segmentIds.length > 0
      ? await this.choiceRepository.find({
          where: { segmentId: In(segmentIds) },
          order: { order: 'ASC' },
        })
      : [];

    return {
      segments,
      choices,
      rootSegmentId: story.rootSegmentId,
    };
  }

  /**
   * Update a segment
   */
  async update(
    id: string,
    updateDto: UpdateSegmentDto,
    userId: string,
  ): Promise<StorySegment> {
    const segment = await this.findById(id);

    // Check permissions
    const canEdit = await this.canEditSegment(segment, userId);
    if (!canEdit.allowed) {
      throw new ForbiddenException(canEdit.reason);
    }

    // Recalculate word count and sanitize if content changed
    if (updateDto.content) {
      const sanitizedContent = this.sanitizeContent(updateDto.content);
      const plainText = this.stripHtml(sanitizedContent);
      segment.wordCount = this.countWords(plainText);
      segment.estimatedReadTime = Math.ceil(segment.wordCount / 200);
      updateDto.content = sanitizedContent;
    }

    // Increment version
    segment.previousVersionId = segment.id;
    segment.version += 1;

    Object.assign(segment, updateDto);
    return this.segmentRepository.save(segment);
  }

  /**
   * Update multiple segment positions (for visual editor drag & drop)
   */
  async bulkUpdatePositions(
    storyId: string,
    dto: BulkUpdatePositionsDto,
    userId: string,
  ): Promise<void> {
    const story = await this.storyRepository.findOne({ where: { id: storyId } });
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    // Only story author can update positions
    if (story.authorId !== userId) {
      throw new ForbiddenException('Only the story author can update segment positions');
    }

    // Update all positions in a transaction
    await this.segmentRepository.manager.transaction(async (manager) => {
      for (const pos of dto.positions) {
        await manager.update(StorySegment, pos.segmentId, {
          position: { x: pos.x, y: pos.y },
        });
      }
    });
  }

  /**
   * Delete a segment
   */
  async delete(id: string, userId: string): Promise<void> {
    const segment = await this.findById(id);

    // Check permissions
    const canEdit = await this.canEditSegment(segment, userId);
    if (!canEdit.allowed) {
      throw new ForbiddenException(canEdit.reason);
    }

    // Prevent deleting root segment if it has children
    if (segment.isRootSegment) {
      const childCount = await this.segmentRepository.count({
        where: { parentSegmentIds: In([segment.id]) },
      });
      if (childCount > 0) {
        throw new BadRequestException('Cannot delete root segment with children. Delete children first.');
      }
    }

    // Remove this segment from parent references of other segments
    const childSegments = await this.segmentRepository
      .createQueryBuilder('segment')
      .where(':id = ANY(segment.parentSegmentIds)', { id })
      .getMany();

    for (const child of childSegments) {
      child.parentSegmentIds = child.parentSegmentIds.filter((pid) => pid !== id);
      await this.segmentRepository.save(child);
    }

    await this.segmentRepository.remove(segment);

    // Update story's root segment reference if needed
    if (segment.isRootSegment) {
      await this.storyRepository.update(segment.storyId, { rootSegmentId: null });
    }
  }

  /**
   * Add a parent segment connection
   */
  async addParentConnection(
    segmentId: string,
    parentSegmentId: string,
    userId: string,
  ): Promise<StorySegment> {
    const segment = await this.findById(segmentId);
    const parentSegment = await this.findById(parentSegmentId);

    // Verify same story
    if (segment.storyId !== parentSegment.storyId) {
      throw new BadRequestException('Segments must be from the same story');
    }

    // Check permissions
    const canEdit = await this.canEditSegment(segment, userId);
    if (!canEdit.allowed) {
      throw new ForbiddenException(canEdit.reason);
    }

    // Prevent cycles
    if (await this.wouldCreateCycle(parentSegmentId, segmentId)) {
      throw new BadRequestException('This connection would create a cycle');
    }

    // Add parent connection
    if (!segment.parentSegmentIds.includes(parentSegmentId)) {
      segment.parentSegmentIds.push(parentSegmentId);
      segment.isRootSegment = false;
      return this.segmentRepository.save(segment);
    }

    return segment;
  }

  /**
   * Remove a parent segment connection
   */
  async removeParentConnection(
    segmentId: string,
    parentSegmentId: string,
    userId: string,
  ): Promise<StorySegment> {
    const segment = await this.findById(segmentId);

    // Check permissions
    const canEdit = await this.canEditSegment(segment, userId);
    if (!canEdit.allowed) {
      throw new ForbiddenException(canEdit.reason);
    }

    segment.parentSegmentIds = segment.parentSegmentIds.filter((id) => id !== parentSegmentId);

    // If no more parents, this becomes a root or orphan
    if (segment.parentSegmentIds.length === 0) {
      segment.isRootSegment = true;
    }

    return this.segmentRepository.save(segment);
  }

  /**
   * Approve a pending segment (for moderated stories)
   */
  async approveSegment(
    segmentId: string,
    approverId: string,
  ): Promise<StorySegment> {
    const segment = await this.findById(segmentId);
    const story = await this.storyRepository.findOne({ where: { id: segment.storyId } });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    // Only story author can approve
    if (story.authorId !== approverId) {
      throw new ForbiddenException('Only the story author can approve segments');
    }

    if (segment.approvalStatus !== 'pending') {
      throw new BadRequestException('Segment is not pending approval');
    }

    segment.approvalStatus = 'approved';
    segment.approvedByUserId = approverId;

    return this.segmentRepository.save(segment);
  }

  /**
   * Reject a pending segment
   */
  async rejectSegment(
    segmentId: string,
    approverId: string,
    reason: string,
  ): Promise<StorySegment> {
    const segment = await this.findById(segmentId);
    const story = await this.storyRepository.findOne({ where: { id: segment.storyId } });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.authorId !== approverId) {
      throw new ForbiddenException('Only the story author can reject segments');
    }

    if (segment.approvalStatus !== 'pending') {
      throw new BadRequestException('Segment is not pending approval');
    }

    segment.approvalStatus = 'rejected';
    segment.approvedByUserId = approverId;
    segment.rejectionReason = reason;

    return this.segmentRepository.save(segment);
  }

  /**
   * Get pending segments for a story
   */
  async getPendingSegments(storyId: string): Promise<StorySegment[]> {
    return this.segmentRepository.find({
      where: { storyId, approvalStatus: 'pending' },
      relations: ['author'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Increment read count for a segment
   */
  async incrementReadCount(id: string): Promise<void> {
    await this.segmentRepository.increment({ id }, 'readCount', 1);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async canCreateSegment(
    story: Story,
    userId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Story author can always create
    if (story.authorId === userId) {
      return { allowed: true };
    }

    switch (story.collaborationMode) {
      case CollaborationMode.PRIVATE:
        return { allowed: false, reason: 'This story does not accept contributions' };
      case CollaborationMode.MODERATED:
      case CollaborationMode.OPEN:
        return { allowed: true };
      default:
        return { allowed: false, reason: 'Unknown collaboration mode' };
    }
  }

  private async canEditSegment(
    segment: StorySegment,
    userId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const story = await this.storyRepository.findOne({
      where: { id: segment.storyId },
    });

    if (!story) {
      return { allowed: false, reason: 'Story not found' };
    }

    // Story author can edit all segments
    if (story.authorId === userId) {
      return { allowed: true };
    }

    // Segment author can edit their own segments (if not approved yet)
    if (segment.authorId === userId && segment.approvalStatus !== 'approved') {
      return { allowed: true };
    }

    return { allowed: false, reason: 'You do not have permission to edit this segment' };
  }

  private async wouldCreateCycle(
    fromId: string,
    toId: string,
    visited: Set<string> = new Set(),
  ): Promise<boolean> {
    if (fromId === toId) {
      return true;
    }

    if (visited.has(fromId)) {
      return false;
    }

    visited.add(fromId);

    const segment = await this.segmentRepository.findOne({ where: { id: fromId } });
    if (!segment) {
      return false;
    }

    for (const parentId of segment.parentSegmentIds) {
      if (await this.wouldCreateCycle(parentId, toId, visited)) {
        return true;
      }
    }

    return false;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }

  /**
   * Sanitize HTML content to prevent XSS attacks.
   * Allows rich text formatting while stripping dangerous elements.
   */
  private sanitizeContent(html: string): string {
    return sanitizeHtml(html, {
      allowedTags: [
        // Text formatting
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins',
        'mark', 'sub', 'sup', 'small',
        // Headings
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        // Lists
        'ul', 'ol', 'li',
        // Block elements
        'blockquote', 'pre', 'code', 'hr', 'div', 'span',
        // Links (with restricted attributes)
        'a',
        // Images (with restricted attributes)
        'img',
        // Tables
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        // Media
        'figure', 'figcaption',
      ],
      allowedAttributes: {
        a: ['href', 'target', 'rel', 'title'],
        img: ['src', 'alt', 'title', 'width', 'height'],
        '*': ['class', 'id'],
        table: ['border', 'cellpadding', 'cellspacing'],
        th: ['colspan', 'rowspan'],
        td: ['colspan', 'rowspan'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      transformTags: {
        a: (tagName, attribs) => ({
          tagName,
          attribs: {
            ...attribs,
            target: '_blank',
            rel: 'noopener noreferrer',
          },
        }),
      },
      // Strip all dangerous tags
      disallowedTagsMode: 'discard',
    });
  }
}
