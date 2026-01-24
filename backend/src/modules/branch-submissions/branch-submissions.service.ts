import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BranchSubmission, Story, StorySegment, Choice, User } from '@/database/entities';
import { CollaborationMode } from '@aardvark/shared';
import {
  CreateBranchSubmissionDto,
  ReviewBranchSubmissionDto,
  UpdateBranchSubmissionDto,
  QueryBranchSubmissionsDto,
} from './dto';
import { filterContent } from './content-filter';

@Injectable()
export class BranchSubmissionsService {
  constructor(
    @InjectRepository(BranchSubmission)
    private readonly submissionRepository: Repository<BranchSubmission>,
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(StorySegment)
    private readonly segmentRepository: Repository<StorySegment>,
    @InjectRepository(Choice)
    private readonly choiceRepository: Repository<Choice>,
  ) {}

  /**
   * Submit a new branch for approval
   */
  async create(
    userId: string,
    dto: CreateBranchSubmissionDto,
  ): Promise<BranchSubmission> {
    // Verify story exists and allows contributions
    const story = await this.storyRepository.findOne({
      where: { id: dto.storyId },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.collaborationMode === CollaborationMode.PRIVATE) {
      throw new ForbiddenException('This story does not accept branch submissions');
    }

    // Verify parent segment exists and belongs to the story
    const parentSegment = await this.segmentRepository.findOne({
      where: { id: dto.parentSegmentId, storyId: dto.storyId },
    });

    if (!parentSegment) {
      throw new NotFoundException('Parent segment not found in this story');
    }

    // Cannot submit to ending segments
    if (parentSegment.isEnding) {
      throw new BadRequestException('Cannot add branches to ending segments');
    }

    // Run content filter on the submission
    const filterResult = filterContent(dto.segmentData.content);

    // Determine status: auto-approve only if open mode AND content passes filter
    let status: 'pending' | 'approved' | 'rejected' | 'revision_requested';
    if (story.collaborationMode === CollaborationMode.OPEN && filterResult.passed) {
      status = 'approved';
    } else {
      status = 'pending';
    }

    // Create submission
    const submission = this.submissionRepository.create({
      storyId: dto.storyId,
      parentSegmentId: dto.parentSegmentId,
      submittedByUserId: userId,
      segmentData: {
        title: dto.segmentData.title || null,
        content: dto.segmentData.content,
        contentMarkdown: dto.segmentData.contentMarkdown || null,
        isEnding: dto.segmentData.isEnding || false,
        endingType: dto.segmentData.endingType || null,
        stateEffects: dto.segmentData.stateEffects || [],
      },
      choicesData: dto.choicesData.map((choice, index) => ({
        choiceText: choice.choiceText,
        order: choice.order || index + 1,
        conditions: choice.conditions || [],
      })),
      submissionNote: dto.submissionNote,
      status,
      filterReasons: !filterResult.passed ? filterResult.reasons : undefined,
    });

    const saved = await this.submissionRepository.save(submission);

    // If approved (open collaboration + passed filter), immediately create the segment
    if (status === 'approved') {
      await this.approveSubmission(saved, story.authorId);
    }

    return this.findOne(saved.id);
  }

  /**
   * Get a single submission by ID
   */
  async findOne(id: string): Promise<BranchSubmission> {
    const submission = await this.submissionRepository.findOne({
      where: { id },
      relations: ['story', 'parentSegment', 'submittedBy', 'reviewedBy', 'createdSegment'],
    });

    if (!submission) {
      throw new NotFoundException('Branch submission not found');
    }

    return submission;
  }

  /**
   * List submissions with filters
   */
  async findAll(
    query: QueryBranchSubmissionsDto,
  ): Promise<{ submissions: BranchSubmission[]; total: number; page: number; limit: number }> {
    const { storyId, submittedByUserId, status, page = 1, limit = 20 } = query;

    const queryBuilder = this.submissionRepository
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.story', 'story')
      .leftJoinAndSelect('submission.parentSegment', 'parentSegment')
      .leftJoinAndSelect('submission.submittedBy', 'submittedBy')
      .leftJoinAndSelect('submission.reviewedBy', 'reviewedBy');

    if (storyId) {
      queryBuilder.andWhere('submission.storyId = :storyId', { storyId });
    }

    if (submittedByUserId) {
      queryBuilder.andWhere('submission.submittedByUserId = :submittedByUserId', {
        submittedByUserId,
      });
    }

    if (status) {
      queryBuilder.andWhere('submission.status = :status', { status });
    }

    queryBuilder
      .orderBy('submission.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [submissions, total] = await queryBuilder.getManyAndCount();

    return { submissions, total, page, limit };
  }

  /**
   * Get pending submissions for a story (for moderators/authors)
   */
  async findPendingForStory(storyId: string): Promise<BranchSubmission[]> {
    return this.submissionRepository.find({
      where: { storyId, status: 'pending' },
      relations: ['parentSegment', 'submittedBy'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get submissions by user
   */
  async findByUser(userId: string): Promise<BranchSubmission[]> {
    return this.submissionRepository.find({
      where: { submittedByUserId: userId },
      relations: ['story', 'parentSegment'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Update a submission (only by submitter, only if pending)
   */
  async update(
    id: string,
    userId: string,
    dto: UpdateBranchSubmissionDto,
  ): Promise<BranchSubmission> {
    const submission = await this.findOne(id);

    if (submission.submittedByUserId !== userId) {
      throw new ForbiddenException('You can only edit your own submissions');
    }

    if (submission.status !== 'pending' && submission.status !== 'revision_requested') {
      throw new BadRequestException('Can only edit pending or revision-requested submissions');
    }

    // Update fields
    if (dto.segmentData) {
      submission.segmentData = {
        ...submission.segmentData,
        ...dto.segmentData,
      };
    }

    if (dto.choicesData) {
      submission.choicesData = dto.choicesData.map((choice, index) => ({
        choiceText: choice.choiceText,
        order: choice.order || index + 1,
        conditions: choice.conditions || [],
      }));
    }

    if (dto.submissionNote) {
      submission.submissionNote = dto.submissionNote;
    }

    // Reset to pending if it was revision_requested
    if (submission.status === 'revision_requested') {
      submission.status = 'pending';
    }

    return this.submissionRepository.save(submission);
  }

  /**
   * Review a submission (approve/reject/request revision)
   */
  async review(
    id: string,
    reviewerId: string,
    dto: ReviewBranchSubmissionDto,
  ): Promise<BranchSubmission> {
    const submission = await this.findOne(id);

    // Verify reviewer is the story author
    const story = await this.storyRepository.findOne({
      where: { id: submission.storyId },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.authorId !== reviewerId) {
      throw new ForbiddenException('Only the story author can review submissions');
    }

    if (submission.status !== 'pending') {
      throw new BadRequestException('Only pending submissions can be reviewed');
    }

    submission.status = dto.status;
    submission.reviewedByUserId = reviewerId;
    submission.reviewNote = dto.reviewNote || null;
    submission.reviewedAt = new Date();

    // If approved, create the actual segment
    if (dto.status === 'approved') {
      await this.approveSubmission(submission, reviewerId);
    }

    return this.submissionRepository.save(submission);
  }

  /**
   * Delete a submission (only by submitter, only if pending)
   */
  async delete(id: string, userId: string): Promise<void> {
    const submission = await this.findOne(id);

    if (submission.submittedByUserId !== userId) {
      throw new ForbiddenException('You can only delete your own submissions');
    }

    if (submission.status !== 'pending' && submission.status !== 'revision_requested') {
      throw new BadRequestException('Can only delete pending or revision-requested submissions');
    }

    await this.submissionRepository.remove(submission);
  }

  /**
   * Get submission statistics for a story
   */
  async getStoryStats(
    storyId: string,
  ): Promise<{ pending: number; approved: number; rejected: number; revisionRequested: number }> {
    const stats = await this.submissionRepository
      .createQueryBuilder('submission')
      .select('submission.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('submission.storyId = :storyId', { storyId })
      .groupBy('submission.status')
      .getRawMany();

    const result = {
      pending: 0,
      approved: 0,
      rejected: 0,
      revisionRequested: 0,
    };

    for (const stat of stats) {
      const statusKey = stat.status === 'revision_requested' ? 'revisionRequested' : stat.status as string;
      if (statusKey in result) {
        result[statusKey as keyof typeof result] = parseInt(stat.count, 10);
      }
    }

    return result;
  }

  /**
   * Private: Create segment and choice from approved submission
   */
  private async approveSubmission(
    submission: BranchSubmission,
    approvedByUserId: string,
  ): Promise<void> {
    // Calculate word count
    const textContent = submission.segmentData.content.replace(/<[^>]*>/g, '');
    const wordCount = textContent.trim().split(/\s+/).filter(Boolean).length;

    // Create the segment
    const segment = this.segmentRepository.create({
      storyId: submission.storyId,
      authorId: submission.submittedByUserId,
      title: submission.segmentData.title,
      content: submission.segmentData.content,
      contentMarkdown: submission.segmentData.contentMarkdown,
      position: { x: 0, y: 0 }, // Will need to be positioned in editor
      parentSegmentIds: [submission.parentSegmentId],
      isRootSegment: false,
      isEnding: submission.segmentData.isEnding,
      endingType: submission.segmentData.endingType,
      stateEffects: submission.segmentData.stateEffects,
      wordCount,
      estimatedReadTime: Math.ceil(wordCount / 200),
      submittedByUserId: submission.submittedByUserId,
      approvedByUserId: approvedByUserId,
      approvalStatus: 'approved',
    });

    const savedSegment = await this.segmentRepository.save(segment);

    // Create the choice connecting parent to this segment
    if (submission.choicesData.length > 0) {
      const choiceData = submission.choicesData[0];
      const choice = this.choiceRepository.create({
        segmentId: submission.parentSegmentId,
        nextSegmentId: savedSegment.id,
        choiceText: choiceData.choiceText,
        order: choiceData.order,
        conditions: choiceData.conditions,
      });

      await this.choiceRepository.save(choice);
    }

    // Update submission with created segment reference
    submission.createdSegmentId = savedSegment.id;
  }
}
