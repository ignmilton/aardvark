import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  ReaderProgress,
  Story,
  StorySegment,
  Choice,
} from "@/database/entities";
import {
  StartReadingDto,
  MakeChoiceDto,
  AddBookmarkDto,
  UpdateBookmarkDto,
} from "./dto";

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(ReaderProgress)
    private readonly progressRepository: Repository<ReaderProgress>,
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(StorySegment)
    private readonly segmentRepository: Repository<StorySegment>,
    @InjectRepository(Choice)
    private readonly choiceRepository: Repository<Choice>,
  ) {}

  /**
   * Start reading a story or get existing progress
   */
  async startReading(
    userId: string,
    dto: StartReadingDto,
  ): Promise<ReaderProgress> {
    // Check if story exists
    const story = await this.storyRepository.findOne({
      where: { id: dto.storyId },
    });
    if (!story) {
      throw new NotFoundException("Story not found");
    }

    if (!story.rootSegmentId) {
      throw new BadRequestException("Story has no content yet");
    }

    // Check for existing progress
    const existing = await this.progressRepository.findOne({
      where: { userId, storyId: dto.storyId },
    });

    if (existing) {
      // Update last read time and return existing progress
      existing.lastReadAt = new Date();
      return this.progressRepository.save(existing);
    }

    // Create new progress
    const progress = this.progressRepository.create({
      userId,
      storyId: dto.storyId,
      currentSegmentId: story.rootSegmentId,
      visitedSegmentIds: [story.rootSegmentId],
      choiceHistory: [],
      stateVariables: {}, // Initialize empty state for tracking reader decisions
      startedAt: new Date(),
      lastReadAt: new Date(),
      totalReadTime: 0,
      bookmarks: [],
    });

    // Increment story view count
    await this.storyRepository.increment({ id: dto.storyId }, "viewCount", 1);

    // Increment segment read count
    await this.segmentRepository.increment(
      { id: story.rootSegmentId },
      "readCount",
      1,
    );

    return this.progressRepository.save(progress);
  }

  /**
   * Get progress for a specific story
   */
  async getProgress(
    userId: string,
    storyId: string,
  ): Promise<ReaderProgress | null> {
    return this.progressRepository.findOne({
      where: { userId, storyId },
      relations: ["story"],
    });
  }

  /**
   * Get all reading progress for a user
   */
  async getUserProgress(
    userId: string,
    isCompleted?: boolean,
  ): Promise<ReaderProgress[]> {
    const query: any = { userId };
    if (isCompleted !== undefined) {
      query.isCompleted = isCompleted;
    }

    return this.progressRepository.find({
      where: query,
      relations: ["story"],
      order: { lastReadAt: "DESC" },
    });
  }

  /**
   * Make a choice and navigate to the next segment
   */
  async makeChoice(
    userId: string,
    storyId: string,
    dto: MakeChoiceDto,
  ): Promise<ReaderProgress> {
    const progress = await this.progressRepository.findOne({
      where: { userId, storyId },
    });

    if (!progress) {
      throw new NotFoundException("No reading progress found for this story");
    }

    if (progress.isCompleted) {
      throw new BadRequestException(
        "Story already completed. Start a new reading to continue.",
      );
    }

    // Verify choice exists and belongs to current segment
    const choice = await this.choiceRepository.findOne({
      where: { id: dto.choiceId },
      relations: ["nextSegment"],
    });

    if (!choice) {
      throw new NotFoundException("Choice not found");
    }

    if (choice.segmentId !== progress.currentSegmentId) {
      throw new BadRequestException(
        "This choice is not available from your current position",
      );
    }

    // Get next segment
    const nextSegment = await this.segmentRepository.findOne({
      where: { id: choice.nextSegmentId },
    });

    if (!nextSegment) {
      throw new NotFoundException("Destination segment not found");
    }

    // Update read time
    if (dto.timeSpent) {
      progress.totalReadTime += dto.timeSpent;
    }

    // Record choice in history
    progress.choiceHistory.push({
      segmentId: progress.currentSegmentId,
      choiceId: dto.choiceId,
      timestamp: new Date(),
    });

    // Apply state effects from this choice
    if (choice.stateEffects) {
      progress.stateVariables = this.applyStateEffects(
        progress.stateVariables,
        choice.stateEffects,
      );
    }

    // Navigate to next segment
    progress.currentSegmentId = choice.nextSegmentId;
    progress.lastReadAt = new Date();

    // Mark as visited
    if (!progress.visitedSegmentIds.includes(choice.nextSegmentId)) {
      progress.visitedSegmentIds.push(choice.nextSegmentId);
      // Increment segment read count
      await this.segmentRepository.increment(
        { id: choice.nextSegmentId },
        "readCount",
        1,
      );
    }

    // Increment choice counter
    await this.choiceRepository.increment(
      { id: dto.choiceId },
      "timesChosen",
      1,
    );

    // Check if this is an ending
    if (nextSegment.isEnding) {
      progress.isCompleted = true;
      progress.completedAt = new Date();
      progress.reachedEndingId = nextSegment.id;
    }

    return this.progressRepository.save(progress);
  }

  /**
   * Navigate directly to a previously visited segment (backtrack)
   */
  async navigateToSegment(
    userId: string,
    storyId: string,
    segmentId: string,
  ): Promise<ReaderProgress> {
    const progress = await this.progressRepository.findOne({
      where: { userId, storyId },
    });

    if (!progress) {
      throw new NotFoundException("No reading progress found");
    }

    // Only allow navigation to visited segments
    if (!progress.visitedSegmentIds.includes(segmentId)) {
      throw new BadRequestException(
        "You can only navigate to previously visited segments",
      );
    }

    progress.currentSegmentId = segmentId;
    progress.lastReadAt = new Date();

    // If navigating back from an ending, mark as not completed
    if (progress.isCompleted) {
      progress.isCompleted = false;
      progress.completedAt = null;
      progress.reachedEndingId = null;
    }

    return this.progressRepository.save(progress);
  }

  /**
   * Reset progress to start over
   */
  async resetProgress(
    userId: string,
    storyId: string,
  ): Promise<ReaderProgress> {
    const progress = await this.progressRepository.findOne({
      where: { userId, storyId },
    });

    if (!progress) {
      throw new NotFoundException("No reading progress found");
    }

    const story = await this.storyRepository.findOne({
      where: { id: storyId },
    });

    if (!story?.rootSegmentId) {
      throw new BadRequestException("Story has no content");
    }

    // Reset to initial state
    progress.currentSegmentId = story.rootSegmentId;
    progress.visitedSegmentIds = [story.rootSegmentId];
    progress.choiceHistory = [];
    progress.stateVariables = {}; // Reset state variables
    progress.startedAt = new Date();
    progress.lastReadAt = new Date();
    progress.totalReadTime = 0;
    progress.isCompleted = false;
    progress.completedAt = null;
    progress.reachedEndingId = null;
    // Keep bookmarks

    return this.progressRepository.save(progress);
  }

  /**
   * Delete progress entirely
   */
  async deleteProgress(userId: string, storyId: string): Promise<void> {
    const progress = await this.progressRepository.findOne({
      where: { userId, storyId },
    });

    if (!progress) {
      throw new NotFoundException("No reading progress found");
    }

    await this.progressRepository.remove(progress);
  }

  /**
   * Add a bookmark
   */
  async addBookmark(
    userId: string,
    storyId: string,
    dto: AddBookmarkDto,
  ): Promise<ReaderProgress> {
    const progress = await this.progressRepository.findOne({
      where: { userId, storyId },
    });

    if (!progress) {
      throw new NotFoundException("No reading progress found");
    }

    // Verify segment belongs to this story
    const segment = await this.segmentRepository.findOne({
      where: { id: dto.segmentId, storyId },
    });

    if (!segment) {
      throw new NotFoundException("Segment not found in this story");
    }

    // Check for duplicate bookmark
    const existing = progress.bookmarks.find(
      (b) => b.segmentId === dto.segmentId,
    );
    if (existing) {
      throw new ConflictException("Bookmark already exists for this segment");
    }

    progress.bookmarks.push({
      segmentId: dto.segmentId,
      note: dto.note || "",
      createdAt: new Date(),
    });

    return this.progressRepository.save(progress);
  }

  /**
   * Update a bookmark note
   */
  async updateBookmark(
    userId: string,
    storyId: string,
    segmentId: string,
    dto: UpdateBookmarkDto,
  ): Promise<ReaderProgress> {
    const progress = await this.progressRepository.findOne({
      where: { userId, storyId },
    });

    if (!progress) {
      throw new NotFoundException("No reading progress found");
    }

    const bookmarkIndex = progress.bookmarks.findIndex(
      (b) => b.segmentId === segmentId,
    );
    if (bookmarkIndex === -1) {
      throw new NotFoundException("Bookmark not found");
    }

    if (dto.note !== undefined) {
      progress.bookmarks[bookmarkIndex].note = dto.note;
    }

    return this.progressRepository.save(progress);
  }

  /**
   * Remove a bookmark
   */
  async removeBookmark(
    userId: string,
    storyId: string,
    segmentId: string,
  ): Promise<ReaderProgress> {
    const progress = await this.progressRepository.findOne({
      where: { userId, storyId },
    });

    if (!progress) {
      throw new NotFoundException("No reading progress found");
    }

    const bookmarkIndex = progress.bookmarks.findIndex(
      (b) => b.segmentId === segmentId,
    );
    if (bookmarkIndex === -1) {
      throw new NotFoundException("Bookmark not found");
    }

    progress.bookmarks.splice(bookmarkIndex, 1);

    return this.progressRepository.save(progress);
  }

  /**
   * Get reading statistics for a user
   */
  async getUserReadingStats(userId: string): Promise<{
    totalStoriesStarted: number;
    storiesCompleted: number;
    totalReadTime: number;
    totalSegmentsRead: number;
    totalChoicesMade: number;
    currentlyReading: number;
  }> {
    const allProgress = await this.progressRepository.find({
      where: { userId },
    });

    return {
      totalStoriesStarted: allProgress.length,
      storiesCompleted: allProgress.filter((p) => p.isCompleted).length,
      totalReadTime: allProgress.reduce((sum, p) => sum + p.totalReadTime, 0),
      totalSegmentsRead: allProgress.reduce(
        (sum, p) => sum + p.visitedSegmentIds.length,
        0,
      ),
      totalChoicesMade: allProgress.reduce(
        (sum, p) => sum + p.choiceHistory.length,
        0,
      ),
      currentlyReading: allProgress.filter((p) => !p.isCompleted).length,
    };
  }

  /**
   * Apply state effects from a choice to the current state variables.
   * Supports $set (set values) and $inc (increment values) operators.
   *
   * @example
   * stateEffects = { "$set": { "met_wizard": true }, "$inc": { "trust_level": 2 } }
   */
  private applyStateEffects(
    currentState: Record<string, unknown>,
    effects: Record<string, unknown>,
  ): Record<string, unknown> {
    const newState = { ...currentState };

    // Handle $set operator - directly set values
    if (effects["$set"] && typeof effects["$set"] === "object") {
      Object.assign(newState, effects["$set"]);
    }

    // Handle $inc operator - increment numeric values
    if (effects["$inc"] && typeof effects["$inc"] === "object") {
      const increments = effects["$inc"] as Record<string, number>;
      for (const [key, value] of Object.entries(increments)) {
        const currentValue =
          typeof newState[key] === "number" ? (newState[key] as number) : 0;
        newState[key] = currentValue + value;
      }
    }

    // Handle direct assignments (for simple cases without operators)
    for (const [key, value] of Object.entries(effects)) {
      if (!key.startsWith("$")) {
        newState[key] = value;
      }
    }

    return newState;
  }

  /**
   * Evaluate whether a choice condition is met based on current state.
   * Supports simple equality, $gte, $lte, $gt, $lt, $ne operators.
   *
   * @example
   * condition = { "has_sword": true, "trust_level": { "$gte": 5 } }
   */
  evaluateCondition(
    currentState: Record<string, unknown>,
    condition: Record<string, unknown> | null,
  ): boolean {
    if (!condition || Object.keys(condition).length === 0) {
      return true; // No condition means always available
    }

    for (const [key, expected] of Object.entries(condition)) {
      const actual = currentState[key];

      // Handle comparison operators
      if (
        expected &&
        typeof expected === "object" &&
        !Array.isArray(expected)
      ) {
        const ops = expected as Record<string, unknown>;

        if (
          "$gte" in ops &&
          (typeof actual !== "number" || actual < (ops["$gte"] as number))
        ) {
          return false;
        }
        if (
          "$lte" in ops &&
          (typeof actual !== "number" || actual > (ops["$lte"] as number))
        ) {
          return false;
        }
        if (
          "$gt" in ops &&
          (typeof actual !== "number" || actual <= (ops["$gt"] as number))
        ) {
          return false;
        }
        if (
          "$lt" in ops &&
          (typeof actual !== "number" || actual >= (ops["$lt"] as number))
        ) {
          return false;
        }
        if ("$ne" in ops && actual === ops["$ne"]) {
          return false;
        }
        if ("$eq" in ops && actual !== ops["$eq"]) {
          return false;
        }
      } else {
        // Simple equality check
        if (actual !== expected) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get available choices for a segment based on current state
   */
  async getAvailableChoices(
    storyId: string,
    segmentId: string,
    stateVariables: Record<string, unknown>,
  ): Promise<Choice[]> {
    const choices = await this.choiceRepository.find({
      where: { segmentId, isHidden: false },
      order: { order: "ASC" },
    });

    // Filter choices based on conditions
    return choices.filter((choice) =>
      this.evaluateCondition(stateVariables, choice.conditionJson),
    );
  }
}
