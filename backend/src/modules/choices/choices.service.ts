import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Choice, StorySegment, Story } from '@/database/entities';
import { CreateChoiceDto, UpdateChoiceDto, ReorderChoicesDto } from './dto';

@Injectable()
export class ChoicesService {
  constructor(
    @InjectRepository(Choice)
    private readonly choiceRepository: Repository<Choice>,
    @InjectRepository(StorySegment)
    private readonly segmentRepository: Repository<StorySegment>,
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
  ) {}

  /**
   * Create a new choice
   */
  async create(createDto: CreateChoiceDto, userId: string): Promise<Choice> {
    // Validate source segment
    const sourceSegment = await this.segmentRepository.findOne({
      where: { id: createDto.segmentId },
    });
    if (!sourceSegment) {
      throw new NotFoundException('Source segment not found');
    }

    // Validate destination segment
    const destSegment = await this.segmentRepository.findOne({
      where: { id: createDto.nextSegmentId },
    });
    if (!destSegment) {
      throw new NotFoundException('Destination segment not found');
    }

    // Verify segments belong to same story
    if (sourceSegment.storyId !== destSegment.storyId) {
      throw new BadRequestException('Source and destination segments must be in the same story');
    }

    // Check permission
    const canEdit = await this.canEditChoice(sourceSegment.storyId, userId);
    if (!canEdit.allowed) {
      throw new ForbiddenException(canEdit.reason);
    }

    // Check for cycle (simple check - destination shouldn't be an ancestor of source)
    if (await this.wouldCreateCycle(createDto.segmentId, createDto.nextSegmentId)) {
      throw new BadRequestException('This choice would create a narrative cycle');
    }

    // Auto-assign order if not provided
    let order = createDto.order || 1;
    if (!createDto.order) {
      const existingChoices = await this.choiceRepository.count({
        where: { segmentId: createDto.segmentId },
      });
      order = existingChoices + 1;
    }

    const choice = this.choiceRepository.create({
      segmentId: createDto.segmentId,
      nextSegmentId: createDto.nextSegmentId,
      choiceText: createDto.choiceText,
      order,
    });

    // Update destination segment's parent references
    if (!destSegment.parentSegmentIds.includes(createDto.segmentId)) {
      destSegment.parentSegmentIds.push(createDto.segmentId);
      destSegment.isRootSegment = false;
      await this.segmentRepository.save(destSegment);
    }

    return this.choiceRepository.save(choice);
  }

  /**
   * Find choice by ID
   */
  async findById(id: string): Promise<Choice> {
    const choice = await this.choiceRepository.findOne({
      where: { id },
      relations: ['segment', 'nextSegment'],
    });

    if (!choice) {
      throw new NotFoundException('Choice not found');
    }

    return choice;
  }

  /**
   * Get all choices for a segment
   */
  async findBySegment(segmentId: string): Promise<Choice[]> {
    return this.choiceRepository.find({
      where: { segmentId },
      relations: ['nextSegment'],
      order: { order: 'ASC' },
    });
  }

  /**
   * Get available choices for a reader (non-hidden choices)
   */
  async getAvailableChoices(segmentId: string): Promise<Choice[]> {
    return this.choiceRepository.find({
      where: { segmentId, isHidden: false },
      relations: ['nextSegment'],
      order: { order: 'ASC' },
    });
  }

  /**
   * Update a choice
   */
  async update(id: string, updateDto: UpdateChoiceDto, userId: string): Promise<Choice> {
    const choice = await this.findById(id);

    // Check permission
    const segment = await this.segmentRepository.findOne({
      where: { id: choice.segmentId },
    });
    if (!segment) {
      throw new NotFoundException('Segment not found');
    }

    const canEdit = await this.canEditChoice(segment.storyId, userId);
    if (!canEdit.allowed) {
      throw new ForbiddenException(canEdit.reason);
    }

    // If changing destination, validate new destination
    if (updateDto.nextSegmentId && updateDto.nextSegmentId !== choice.nextSegmentId) {
      const newDest = await this.segmentRepository.findOne({
        where: { id: updateDto.nextSegmentId },
      });
      if (!newDest) {
        throw new NotFoundException('New destination segment not found');
      }
      if (newDest.storyId !== segment.storyId) {
        throw new BadRequestException('Destination must be in the same story');
      }

      // Check for cycle
      if (await this.wouldCreateCycle(choice.segmentId, updateDto.nextSegmentId)) {
        throw new BadRequestException('This change would create a narrative cycle');
      }

      // Update parent references
      const oldDest = await this.segmentRepository.findOne({
        where: { id: choice.nextSegmentId },
      });
      if (oldDest) {
        // Remove old parent reference if no other choices point to it from same segment
        const otherChoices = await this.choiceRepository.count({
          where: { segmentId: choice.segmentId, nextSegmentId: choice.nextSegmentId },
        });
        if (otherChoices <= 1) {
          oldDest.parentSegmentIds = oldDest.parentSegmentIds.filter(
            (pid) => pid !== choice.segmentId,
          );
          await this.segmentRepository.save(oldDest);
        }
      }

      // Add new parent reference
      if (!newDest.parentSegmentIds.includes(choice.segmentId)) {
        newDest.parentSegmentIds.push(choice.segmentId);
        newDest.isRootSegment = false;
        await this.segmentRepository.save(newDest);
      }
    }

    Object.assign(choice, updateDto);
    return this.choiceRepository.save(choice);
  }

  /**
   * Reorder choices within a segment
   */
  async reorderChoices(
    segmentId: string,
    dto: ReorderChoicesDto,
    userId: string,
  ): Promise<Choice[]> {
    const segment = await this.segmentRepository.findOne({
      where: { id: segmentId },
    });
    if (!segment) {
      throw new NotFoundException('Segment not found');
    }

    const canEdit = await this.canEditChoice(segment.storyId, userId);
    if (!canEdit.allowed) {
      throw new ForbiddenException(canEdit.reason);
    }

    // Verify all choices belong to this segment
    const choices = await this.choiceRepository.find({
      where: { id: In(dto.choiceIds), segmentId },
    });

    if (choices.length !== dto.choiceIds.length) {
      throw new BadRequestException('Some choice IDs are invalid or belong to different segment');
    }

    // Update order
    await this.choiceRepository.manager.transaction(async (manager) => {
      for (let i = 0; i < dto.choiceIds.length; i++) {
        await manager.update(Choice, dto.choiceIds[i], { order: i + 1 });
      }
    });

    return this.findBySegment(segmentId);
  }

  /**
   * Delete a choice
   */
  async delete(id: string, userId: string): Promise<void> {
    const choice = await this.findById(id);

    const segment = await this.segmentRepository.findOne({
      where: { id: choice.segmentId },
    });
    if (!segment) {
      throw new NotFoundException('Segment not found');
    }

    const canEdit = await this.canEditChoice(segment.storyId, userId);
    if (!canEdit.allowed) {
      throw new ForbiddenException(canEdit.reason);
    }

    // Update destination segment's parent references
    const destSegment = await this.segmentRepository.findOne({
      where: { id: choice.nextSegmentId },
    });
    if (destSegment) {
      // Check if other choices still connect to destination
      const otherChoices = await this.choiceRepository.count({
        where: { segmentId: choice.segmentId, nextSegmentId: choice.nextSegmentId },
      });
      if (otherChoices <= 1) {
        destSegment.parentSegmentIds = destSegment.parentSegmentIds.filter(
          (pid) => pid !== choice.segmentId,
        );
        if (destSegment.parentSegmentIds.length === 0) {
          destSegment.isRootSegment = true;
        }
        await this.segmentRepository.save(destSegment);
      }
    }

    await this.choiceRepository.remove(choice);

    // Reorder remaining choices
    const remainingChoices = await this.choiceRepository.find({
      where: { segmentId: choice.segmentId },
      order: { order: 'ASC' },
    });
    for (let i = 0; i < remainingChoices.length; i++) {
      if (remainingChoices[i].order !== i + 1) {
        remainingChoices[i].order = i + 1;
        await this.choiceRepository.save(remainingChoices[i]);
      }
    }
  }

  /**
   * Increment times chosen counter
   */
  async incrementTimesChosen(id: string): Promise<void> {
    await this.choiceRepository.increment({ id }, 'timesChosen', 1);
  }

  /**
   * Get choice statistics for a segment
   */
  async getChoiceStats(segmentId: string): Promise<{
    choiceId: string;
    choiceText: string;
    timesChosen: number;
    percentage: number;
  }[]> {
    const choices = await this.choiceRepository.find({
      where: { segmentId },
      order: { order: 'ASC' },
    });

    const totalChosen = choices.reduce((sum, c) => sum + c.timesChosen, 0);

    return choices.map((c) => ({
      choiceId: c.id,
      choiceText: c.choiceText,
      timesChosen: c.timesChosen,
      percentage: totalChosen > 0 ? Math.round((c.timesChosen / totalChosen) * 100) : 0,
    }));
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async canEditChoice(
    storyId: string,
    userId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const story = await this.storyRepository.findOne({ where: { id: storyId } });
    if (!story) {
      return { allowed: false, reason: 'Story not found' };
    }

    if (story.authorId === userId) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Only the story author can edit choices' };
  }

  private async wouldCreateCycle(
    sourceId: string,
    destId: string,
    visited: Set<string> = new Set(),
  ): Promise<boolean> {
    // Check if navigating from dest could reach source
    if (destId === sourceId) {
      return true;
    }

    if (visited.has(destId)) {
      return false;
    }

    visited.add(destId);

    const choices = await this.choiceRepository.find({
      where: { segmentId: destId },
    });

    for (const choice of choices) {
      if (await this.wouldCreateCycle(sourceId, choice.nextSegmentId, visited)) {
        return true;
      }
    }

    return false;
  }
}
