import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThanOrEqual, DataSource } from "typeorm";
import {
  Rating,
  Story,
  ReaderProgress,
  Transaction,
  User,
} from "@/database/entities";
import { CreateRatingDto, UpdateRatingDto, RatingQueryDto } from "./dto";
import { TransactionType, DEFAULT_CREDIT_CONFIG } from "@aardvark/shared";
import * as sanitizeHtml from "sanitize-html";
import { marked } from "marked";

@Injectable()
export class RatingsService {
  private readonly logger = new Logger(RatingsService.name);

  constructor(
    @InjectRepository(Rating)
    private readonly ratingRepository: Repository<Rating>,
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(ReaderProgress)
    private readonly progressRepository: Repository<ReaderProgress>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a new rating/review
   */
  async create(createDto: CreateRatingDto, userId: string): Promise<Rating> {
    // Verify story exists
    const story = await this.storyRepository.findOne({
      where: { id: createDto.storyId },
    });
    if (!story) {
      throw new NotFoundException("Story not found");
    }

    // Check if user already rated this story
    const existing = await this.ratingRepository.findOne({
      where: { userId, storyId: createDto.storyId },
    });
    if (existing) {
      throw new ConflictException(
        "You have already rated this story. Use update instead.",
      );
    }

    // Check if user has read the story (verified reader)
    const progress = await this.progressRepository.findOne({
      where: { userId, storyId: createDto.storyId },
    });
    const isVerifiedReader = progress?.isCompleted || false;

    // Process review text if provided
    let reviewHtml: string | null = null;
    if (createDto.reviewText) {
      reviewHtml = this.processContent(createDto.reviewText);
    }

    const rating = this.ratingRepository.create({
      userId,
      storyId: createDto.storyId,
      rating: createDto.rating,
      reviewTitle: createDto.reviewTitle || null,
      reviewText: createDto.reviewText || null,
      reviewHtml,
      isVerifiedReader,
    });

    const savedRating = await this.ratingRepository.save(rating);

    // Update story's rating statistics
    await this.updateStoryRatingStats(createDto.storyId);

    // Award credit for review (if review text provided and user hasn't exceeded daily limit)
    if (createDto.reviewText && createDto.reviewText.length >= 50) {
      await this.awardReviewCredit(userId, savedRating.id, story.title);
    }

    // Load user relation for response
    return this.ratingRepository.findOne({
      where: { id: savedRating.id },
      relations: ["user"],
    }) as Promise<Rating>;
  }

  /**
   * Get ratings with pagination
   */
  async findAll(query: RatingQueryDto) {
    const {
      storyId,
      userId,
      withReview,
      minRating,
      page = 1,
      limit = 20,
      sortBy = "recent",
    } = query;

    const queryBuilder = this.ratingRepository
      .createQueryBuilder("rating")
      .leftJoinAndSelect("rating.user", "user");

    if (storyId) {
      queryBuilder.andWhere("rating.storyId = :storyId", { storyId });
    }

    if (userId) {
      queryBuilder.andWhere("rating.userId = :userId", { userId });
    }

    if (withReview) {
      queryBuilder.andWhere("rating.reviewText IS NOT NULL");
    }

    if (minRating !== undefined) {
      queryBuilder.andWhere("rating.rating >= :minRating", { minRating });
    }

    // Sorting
    switch (sortBy) {
      case "helpful":
        queryBuilder.orderBy("rating.helpfulCount", "DESC");
        break;
      case "rating_high":
        queryBuilder.orderBy("rating.rating", "DESC");
        break;
      case "rating_low":
        queryBuilder.orderBy("rating.rating", "ASC");
        break;
      case "recent":
      default:
        queryBuilder.orderBy("rating.createdAt", "DESC");
    }

    const skip = (page - 1) * limit;
    const [ratings, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: ratings.map((r) => this.sanitizeRating(r)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a user's rating for a story
   */
  async getUserRating(storyId: string, userId: string): Promise<Rating | null> {
    return this.ratingRepository.findOne({
      where: { storyId, userId },
    });
  }

  /**
   * Get rating by ID
   */
  async findById(id: string): Promise<Rating> {
    const rating = await this.ratingRepository.findOne({
      where: { id },
      relations: ["user", "story"],
    });

    if (!rating) {
      throw new NotFoundException("Rating not found");
    }

    return this.sanitizeRating(rating) as Rating;
  }

  /**
   * Get rating distribution for a story
   */
  async getRatingDistribution(storyId: string): Promise<{
    distribution: { rating: number; count: number; percentage: number }[];
    average: number;
    total: number;
  }> {
    const ratings = await this.ratingRepository
      .createQueryBuilder("rating")
      .select("rating.rating", "rating")
      .addSelect("COUNT(*)", "count")
      .where("rating.storyId = :storyId", { storyId })
      .groupBy("rating.rating")
      .getRawMany();

    const total = ratings.reduce((sum, r) => sum + parseInt(r.count), 0);
    const weightedSum = ratings.reduce(
      (sum, r) => sum + parseFloat(r.rating) * parseInt(r.count),
      0,
    );
    const average = total > 0 ? weightedSum / total : 0;

    const distribution = [5, 4, 3, 2, 1].map((ratingValue) => {
      const found = ratings.find((r) => parseFloat(r.rating) === ratingValue);
      const count = found ? parseInt(found.count) : 0;
      return {
        rating: ratingValue,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    });

    return {
      distribution,
      average: Math.round(average * 10) / 10,
      total,
    };
  }

  /**
   * Update a rating
   */
  async update(
    id: string,
    updateDto: UpdateRatingDto,
    userId: string,
  ): Promise<Rating> {
    const rating = await this.ratingRepository.findOne({
      where: { id },
      relations: ["user"],
    });

    if (!rating) {
      throw new NotFoundException("Rating not found");
    }

    if (rating.userId !== userId) {
      throw new ForbiddenException("You can only edit your own ratings");
    }

    if (updateDto.rating !== undefined) {
      rating.rating = updateDto.rating;
    }

    if (updateDto.reviewTitle !== undefined) {
      rating.reviewTitle = updateDto.reviewTitle || null;
    }

    if (updateDto.reviewText !== undefined) {
      rating.reviewText = updateDto.reviewText || null;
      rating.reviewHtml = updateDto.reviewText
        ? this.processContent(updateDto.reviewText)
        : null;
    }

    rating.isEdited = true;

    const savedRating = await this.ratingRepository.save(rating);

    // Update story's rating statistics
    await this.updateStoryRatingStats(rating.storyId);

    return savedRating;
  }

  /**
   * Delete a rating
   */
  async delete(id: string, userId: string): Promise<void> {
    const rating = await this.ratingRepository.findOne({
      where: { id },
    });

    if (!rating) {
      throw new NotFoundException("Rating not found");
    }

    if (rating.userId !== userId) {
      throw new ForbiddenException("You can only delete your own ratings");
    }

    const storyId = rating.storyId;
    await this.ratingRepository.remove(rating);

    // Update story's rating statistics
    await this.updateStoryRatingStats(storyId);
  }

  /**
   * Mark a review as helpful
   */
  async markHelpful(ratingId: string, _userId: string): Promise<void> {
    // In a full implementation, track which users marked which reviews helpful
    await this.ratingRepository.increment({ id: ratingId }, "helpfulCount", 1);
  }

  /**
   * Get featured reviews for a story
   */
  async getFeaturedReviews(storyId: string, limit = 3): Promise<Rating[]> {
    return this.ratingRepository.find({
      where: { storyId, isFeatured: true, reviewText: undefined }, // reviewText not null
      relations: ["user"],
      order: { helpfulCount: "DESC" },
      take: limit,
    });
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Award credit for writing a review (max 5/day per design doc)
   */
  private async awardReviewCredit(
    userId: string,
    ratingId: string,
    storyTitle: string,
  ): Promise<void> {
    try {
      // Check daily limit
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const todayReviewRewards = await this.transactionRepository.count({
        where: {
          userId,
          type: TransactionType.REVIEW_REWARD,
          createdAt: MoreThanOrEqual(today),
        },
      });

      if (todayReviewRewards >= DEFAULT_CREDIT_CONFIG.maxReviewRewardsPerDay) {
        this.logger.log(
          `User ${userId} has reached daily review reward limit (${DEFAULT_CREDIT_CONFIG.maxReviewRewardsPerDay})`,
        );
        return;
      }

      // Award credit
      await this.dataSource.transaction(async (manager) => {
        const userRepo = manager.getRepository(User);
        const txRepo = manager.getRepository(Transaction);

        const user = await userRepo.findOne({
          where: { id: userId },
          lock: { mode: "pessimistic_write" },
        });

        if (!user) return;

        const newBalance =
          user.creditsBalance + DEFAULT_CREDIT_CONFIG.reviewRewardCredits;
        await userRepo.update(userId, { creditsBalance: newBalance });

        const transaction = txRepo.create({
          userId,
          type: TransactionType.REVIEW_REWARD,
          amount: DEFAULT_CREDIT_CONFIG.reviewRewardCredits,
          balance: newBalance,
          description: `Review reward for "${storyTitle}"`,
          referenceId: ratingId,
          referenceType: "rating",
        });

        await txRepo.save(transaction);
        this.logger.log(
          `Awarded ${DEFAULT_CREDIT_CONFIG.reviewRewardCredits} credit(s) to user ${userId} for review`,
        );
      });
    } catch (error) {
      // Don't fail the rating creation if credit award fails
      this.logger.error(`Failed to award review credit: ${error.message}`);
    }
  }

  private async updateStoryRatingStats(storyId: string): Promise<void> {
    const result = await this.ratingRepository
      .createQueryBuilder("rating")
      .select("AVG(rating.rating)", "average")
      .addSelect("COUNT(*)", "count")
      .where("rating.storyId = :storyId", { storyId })
      .getRawOne();

    const averageRating = parseFloat(result.average) || 0;
    const ratingCount = parseInt(result.count) || 0;

    await this.storyRepository.update(storyId, {
      averageRating: Math.round(averageRating * 10) / 10,
      ratingsCount: ratingCount,
    });
  }

  private processContent(markdown: string): string {
    const rawHtml = marked.parse(markdown, { async: false }) as string;

    return sanitizeHtml(rawHtml, {
      allowedTags: [
        "p",
        "br",
        "strong",
        "em",
        "u",
        "s",
        "ul",
        "ol",
        "li",
        "blockquote",
      ],
      allowedAttributes: {},
    });
  }

  private sanitizeRating(rating: Rating): Partial<Rating> {
    const result: any = { ...rating };

    if (result.user) {
      result.user = {
        id: result.user.id,
        username: result.user.username,
        displayName: result.user.displayName,
        avatarUrl: result.user.avatarUrl,
      };
    }

    return result;
  }
}
