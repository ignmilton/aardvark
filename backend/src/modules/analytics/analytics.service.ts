import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Story,
  StorySegment,
  ReaderProgress,
  Comment,
  Rating,
  Transaction,
  Choice,
  User,
} from "@entities";
import { PLATFORM_FEE_PERCENTAGE } from "@aardvark/shared";
import {
  AuthorDashboard,
  TopStory,
  RecentActivity,
  StoryAnalytics,
  BranchHeatmap,
  EngagementPoint,
  SegmentStat,
  ReaderStats,
  EarningsBreakdown,
  StoryEarnings,
  TypeEarnings,
  PeriodEarnings,
  BranchPopularity,
  BranchChoice,
  CompletionFunnel,
  FunnelSegment,
  DropoffPoint,
  EngagementTrends,
  ExportResult,
  ExportFormatType,
} from "./analytics.types";
import { AnalyticsPeriod } from "./dto/analytics.dto";

/**
 * Service for comprehensive analytics and reporting.
 * Provides insights into story performance, reader engagement, and earnings.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(StorySegment)
    private readonly segmentRepository: Repository<StorySegment>,
    @InjectRepository(ReaderProgress)
    private readonly progressRepository: Repository<ReaderProgress>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Rating)
    private readonly ratingRepository: Repository<Rating>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Choice)
    private readonly choiceRepository: Repository<Choice>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Get the period date range based on period type
   */
  private getPeriodDateRange(period: AnalyticsPeriod): {
    startDate: Date;
    endDate: Date;
  } {
    const endDate = new Date();
    let startDate = new Date();

    switch (period) {
      case AnalyticsPeriod.DAY:
        startDate.setDate(endDate.getDate() - 1);
        break;
      case AnalyticsPeriod.WEEK:
        startDate.setDate(endDate.getDate() - 7);
        break;
      case AnalyticsPeriod.MONTH:
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case AnalyticsPeriod.YEAR:
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      case AnalyticsPeriod.ALL:
        startDate = new Date(0); // Beginning of time
        break;
    }

    return { startDate, endDate };
  }

  /**
   * Verify that the author owns the story
   */
  private async verifyStoryOwnership(
    storyId: string,
    authorId: string,
  ): Promise<Story> {
    const story = await this.storyRepository.findOne({
      where: { id: storyId },
    });

    if (!story) {
      throw new NotFoundException("Story not found");
    }

    if (story.authorId !== authorId) {
      throw new ForbiddenException("You do not have access to this story");
    }

    return story;
  }

  /**
   * Get author dashboard summary
   */
  async getAuthorDashboard(authorId: string): Promise<AuthorDashboard> {
    const { startDate: currentStart, endDate } = this.getPeriodDateRange(
      AnalyticsPeriod.MONTH,
    );
    const { startDate: previousStart } = this.getPeriodDateRange(
      AnalyticsPeriod.MONTH,
    );
    previousStart.setMonth(previousStart.getMonth() - 1);

    // Get basic story counts
    const [totalStories, publishedStories] = await Promise.all([
      this.storyRepository.count({ where: { authorId } }),
      this.storyRepository.count({
        where: { authorId, status: "PUBLISHED" as any },
      }),
    ]);

    // Get aggregated stats
    const stats = await this.storyRepository
      .createQueryBuilder("story")
      .select("SUM(story.viewCount)", "totalReads")
      .addSelect("SUM(story.uniqueReaders)", "uniqueReaders")
      .addSelect("AVG(story.averageRating)", "avgRating")
      .where("story.authorId = :authorId", { authorId })
      .getRawOne();

    // Get total comments and ratings
    const [totalComments, totalRatings] = await Promise.all([
      this.commentRepository
        .createQueryBuilder("comment")
        .innerJoin("comment.story", "story")
        .where("story.authorId = :authorId", { authorId })
        .getCount(),
      this.ratingRepository
        .createQueryBuilder("rating")
        .innerJoin("rating.story", "story")
        .where("story.authorId = :authorId", { authorId })
        .getCount(),
    ]);

    // Get earnings for current and previous periods
    const [currentEarnings, previousEarnings] = await Promise.all([
      this.getAuthorEarnings(authorId, currentStart, endDate),
      this.getAuthorEarnings(authorId, previousStart, currentStart),
    ]);

    // Get unique readers for current and previous periods
    const [currentReaders, previousReaders] = await Promise.all([
      this.getUniqueReadersInPeriod(authorId, currentStart, endDate),
      this.getUniqueReadersInPeriod(authorId, previousStart, currentStart),
    ]);

    // Get top stories
    const topStories = await this.getTopStories(authorId, 5);

    // Get recent activity
    const recentActivity = await this.getRecentActivity(authorId, 10);

    // Calculate trends
    const earningsTrend = {
      current: currentEarnings,
      previous: previousEarnings,
      percentChange:
        previousEarnings > 0
          ? ((currentEarnings - previousEarnings) / previousEarnings) * 100
          : 0,
    };

    const readersTrend = {
      current: currentReaders,
      previous: previousReaders,
      percentChange:
        previousReaders > 0
          ? ((currentReaders - previousReaders) / previousReaders) * 100
          : 0,
    };

    return {
      totalReads: parseInt(stats.totalReads || "0"),
      uniqueReaders: parseInt(stats.uniqueReaders || "0"),
      totalEarnings: currentEarnings,
      avgRating: parseFloat(stats.avgRating || "0"),
      totalStories,
      publishedStories,
      totalComments,
      totalRatings,
      topStories,
      recentActivity,
      earningsTrend,
      readersTrend,
    };
  }

  /**
   * Get author earnings in a date range
   */
  private async getAuthorEarnings(
    authorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const result = await this.transactionRepository
      .createQueryBuilder("txn")
      .select("SUM(txn.amount)", "total")
      .where("txn.userId = :authorId", { authorId })
      .andWhere("txn.createdAt >= :startDate", { startDate })
      .andWhere("txn.createdAt < :endDate", { endDate })
      .andWhere("txn.type IN ('STORY_EARNINGS', 'AD_REWARD')")
      .andWhere("txn.amount > 0")
      .getRawOne();

    return parseFloat(result?.total || "0");
  }

  /**
   * Get unique readers in a period
   */
  private async getUniqueReadersInPeriod(
    authorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const result = await this.progressRepository
      .createQueryBuilder("progress")
      .innerJoin("progress.story", "story")
      .select("COUNT(DISTINCT progress.userId)", "count")
      .where("story.authorId = :authorId", { authorId })
      .andWhere("progress.startedAt >= :startDate", { startDate })
      .andWhere("progress.startedAt < :endDate", { endDate })
      .getRawOne();

    return parseInt(result?.count || "0");
  }

  /**
   * Get recent activity for author's stories
   */
  private async getRecentActivity(
    authorId: string,
    limit: number,
  ): Promise<RecentActivity[]> {
    const activities: RecentActivity[] = [];

    // Get recent reads
    const recentReads = await this.progressRepository
      .createQueryBuilder("progress")
      .innerJoinAndSelect("progress.story", "story")
      .innerJoinAndSelect("progress.user", "user")
      .where("story.authorId = :authorId", { authorId })
      .orderBy("progress.startedAt", "DESC")
      .limit(limit)
      .getMany();

    for (const read of recentReads) {
      activities.push({
        type: "read",
        storyId: read.storyId,
        storyTitle: read.story.title,
        userId: read.userId,
        username: read.user.username,
        timestamp: read.startedAt,
      });
    }

    // Get recent comments
    const recentComments = await this.commentRepository
      .createQueryBuilder("comment")
      .innerJoinAndSelect("comment.story", "story")
      .innerJoinAndSelect("comment.user", "user")
      .where("story.authorId = :authorId", { authorId })
      .orderBy("comment.createdAt", "DESC")
      .limit(limit)
      .getMany();

    for (const comment of recentComments) {
      activities.push({
        type: "comment",
        storyId: comment.storyId,
        storyTitle: comment.story.title,
        userId: comment.userId,
        username: comment.user.username,
        content: comment.content.substring(0, 100),
        timestamp: comment.createdAt,
      });
    }

    // Get recent ratings
    const recentRatings = await this.ratingRepository
      .createQueryBuilder("rating")
      .innerJoinAndSelect("rating.story", "story")
      .innerJoinAndSelect("rating.user", "user")
      .where("story.authorId = :authorId", { authorId })
      .orderBy("rating.createdAt", "DESC")
      .limit(limit)
      .getMany();

    for (const rating of recentRatings) {
      activities.push({
        type: "rating",
        storyId: rating.storyId,
        storyTitle: rating.story.title,
        userId: rating.userId,
        username: rating.user.username,
        rating: parseFloat(rating.rating.toString()),
        timestamp: rating.createdAt,
      });
    }

    // Get recent earnings
    const recentEarnings = await this.transactionRepository
      .createQueryBuilder("txn")
      .where("txn.userId = :authorId", { authorId })
      .andWhere("txn.type IN ('STORY_EARNINGS', 'AD_REWARD')")
      .andWhere("txn.amount > 0")
      .orderBy("txn.createdAt", "DESC")
      .limit(limit)
      .getMany();

    for (const txn of recentEarnings) {
      const story =
        txn.referenceType === "story" && txn.referenceId
          ? await this.storyRepository.findOne({
              where: { id: txn.referenceId },
            })
          : null;

      activities.push({
        type: "earning",
        storyId: story?.id || "",
        storyTitle: story?.title || "Unknown",
        amount: txn.amount,
        timestamp: txn.createdAt,
      });
    }

    // Sort all activities by timestamp and return top N
    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get detailed story analytics
   */
  async getStoryAnalytics(
    storyId: string,
    authorId: string,
  ): Promise<StoryAnalytics> {
    const story = await this.verifyStoryOwnership(storyId, authorId);

    // Get rating distribution
    const ratingDist = await this.ratingRepository
      .createQueryBuilder("rating")
      .select("rating.rating", "rating")
      .addSelect("COUNT(*)", "count")
      .where("rating.storyId = :storyId", { storyId })
      .groupBy("rating.rating")
      .getRawMany();

    const ratingDistribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    for (const dist of ratingDist) {
      const rating = Math.round(parseFloat(dist.rating));
      if (rating >= 1 && rating <= 5) {
        ratingDistribution[rating as 1 | 2 | 3 | 4 | 5] = parseInt(dist.count);
      }
    }

    // Get branch heatmap
    const branchHeatmap = await this.getBranchHeatmap(storyId);

    // Get engagement by day (last 30 days)
    const engagementByDay = await this.getStoryEngagementByDay(storyId, 30);

    // Get top segments
    const topSegments = await this.getTopSegments(storyId, 10);

    // Get total comments and earnings
    const [totalComments, totalEarnings] = await Promise.all([
      this.commentRepository.count({ where: { storyId } }),
      this.getStoryEarnings(storyId),
    ]);

    // Calculate average read time
    const avgReadTimeResult = await this.progressRepository
      .createQueryBuilder("progress")
      .select("AVG(progress.totalReadTime)", "avg")
      .where("progress.storyId = :storyId", { storyId })
      .getRawOne();

    return {
      storyId,
      title: story.title,
      views: story.viewCount,
      uniqueReaders: story.uniqueReaders,
      completionRate: parseFloat(story.completionRate.toString()),
      avgReadTime: parseFloat(avgReadTimeResult?.avg || "0"),
      avgRating: parseFloat(story.averageRating.toString()),
      totalRatings: story.ratingsCount,
      totalComments,
      totalEarnings,
      ratingDistribution,
      branchHeatmap,
      engagementByDay,
      topSegments,
    };
  }

  /**
   * Get branch heatmap data
   */
  private async getBranchHeatmap(storyId: string): Promise<BranchHeatmap[]> {
    const choices = await this.choiceRepository
      .createQueryBuilder("choice")
      .innerJoinAndSelect("choice.segment", "segment")
      .innerJoinAndSelect("choice.nextSegment", "nextSegment")
      .where("segment.storyId = :storyId", { storyId })
      .orderBy("choice.timesChosen", "DESC")
      .getMany();

    const totalChoices = choices.reduce(
      (sum, choice) => sum + choice.timesChosen,
      0,
    );

    return choices.map((choice) => ({
      segmentId: choice.segmentId,
      segmentTitle: choice.segment.title,
      choiceId: choice.id,
      choiceText: choice.choiceText,
      nextSegmentId: choice.nextSegmentId,
      timesSelected: choice.timesChosen,
      percentage:
        totalChoices > 0 ? (choice.timesChosen / totalChoices) * 100 : 0,
    }));
  }

  /**
   * Get engagement by day for a story
   */
  private async getStoryEngagementByDay(
    storyId: string,
    days: number,
  ): Promise<EngagementPoint[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily reads
    const reads = await this.progressRepository
      .createQueryBuilder("progress")
      .select("DATE(progress.startedAt AT TIME ZONE 'UTC')", "date")
      .addSelect("COUNT(*)", "reads")
      .addSelect("COUNT(DISTINCT progress.userId)", "uniqueReaders")
      .where("progress.storyId = :storyId", { storyId })
      .andWhere("progress.startedAt >= :startDate", { startDate })
      .groupBy("date")
      .orderBy("date", "ASC")
      .getRawMany();

    // Get daily completions
    const completions = await this.progressRepository
      .createQueryBuilder("progress")
      .select("DATE(progress.completedAt AT TIME ZONE 'UTC')", "date")
      .addSelect("COUNT(*)", "completions")
      .where("progress.storyId = :storyId", { storyId })
      .andWhere("progress.isCompleted = true")
      .andWhere("progress.completedAt >= :startDate", { startDate })
      .groupBy("date")
      .orderBy("date", "ASC")
      .getRawMany();

    // Get daily comments
    const comments = await this.commentRepository
      .createQueryBuilder("comment")
      .select("DATE(comment.createdAt AT TIME ZONE 'UTC')", "date")
      .addSelect("COUNT(*)", "comments")
      .where("comment.storyId = :storyId", { storyId })
      .andWhere("comment.createdAt >= :startDate", { startDate })
      .groupBy("date")
      .orderBy("date", "ASC")
      .getRawMany();

    // Get daily ratings
    const ratings = await this.ratingRepository
      .createQueryBuilder("rating")
      .select("DATE(rating.createdAt AT TIME ZONE 'UTC')", "date")
      .addSelect("COUNT(*)", "ratings")
      .where("rating.storyId = :storyId", { storyId })
      .andWhere("rating.createdAt >= :startDate", { startDate })
      .groupBy("date")
      .orderBy("date", "ASC")
      .getRawMany();

    // Merge all data by date
    const dataMap = new Map<string, EngagementPoint>();

    for (const read of reads) {
      dataMap.set(read.date, {
        date: read.date,
        reads: parseInt(read.reads),
        uniqueReaders: parseInt(read.uniqueReaders),
        completions: 0,
        comments: 0,
        ratings: 0,
        earnings: 0,
      });
    }

    for (const completion of completions) {
      const existing = dataMap.get(completion.date);
      if (existing) {
        existing.completions = parseInt(completion.completions);
      }
    }

    for (const comment of comments) {
      const existing = dataMap.get(comment.date);
      if (existing) {
        existing.comments = parseInt(comment.comments);
      }
    }

    for (const rating of ratings) {
      const existing = dataMap.get(rating.date);
      if (existing) {
        existing.ratings = parseInt(rating.ratings);
      }
    }

    return Array.from(dataMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }

  /**
   * Get top performing segments
   */
  private async getTopSegments(
    storyId: string,
    limit: number,
  ): Promise<SegmentStat[]> {
    const segments = await this.segmentRepository
      .createQueryBuilder("segment")
      .leftJoinAndSelect("segment.choices", "choice")
      .where("segment.storyId = :storyId", { storyId })
      .orderBy("segment.readCount", "DESC")
      .limit(limit)
      .getMany();

    return segments.map((segment) => {
      let dropoffRate = 0;
      if (!segment.isEnding && segment.readCount > 0) {
        const totalChosen = (segment.choices || []).reduce(
          (sum, c) => sum + (c.timesChosen || 0),
          0,
        );
        dropoffRate = Math.round(
          ((segment.readCount - totalChosen) / segment.readCount) * 100,
        );
        if (dropoffRate < 0) dropoffRate = 0;
      }
      return {
        segmentId: segment.id,
        title: segment.title,
        readCount: segment.readCount,
        avgTimeSpent: segment.estimatedReadTime,
        dropoffRate,
      };
    });
  }

  /**
   * Get earnings for a specific story
   */
  private async getStoryEarnings(storyId: string): Promise<number> {
    const result = await this.transactionRepository
      .createQueryBuilder("txn")
      .select("SUM(txn.amount)", "total")
      .where("txn.referenceId = :storyId", { storyId })
      .andWhere("txn.referenceType = 'story'")
      .andWhere("txn.amount > 0")
      .getRawOne();

    return parseFloat(result?.total || "0");
  }

  /**
   * Get top performing stories
   */
  async getTopStories(
    authorId: string,
    limit: number = 10,
    period?: AnalyticsPeriod,
  ): Promise<TopStory[]> {
    let query = this.storyRepository
      .createQueryBuilder("story")
      .where("story.authorId = :authorId", { authorId })
      .orderBy("story.viewCount", "DESC")
      .limit(limit);

    // If period is specified, filter by publication date
    if (period && period !== AnalyticsPeriod.ALL) {
      const { startDate } = this.getPeriodDateRange(period);
      query = query.andWhere("story.publishedAt >= :startDate", { startDate });
    }

    const stories = await query.getMany();

    // Get earnings for each story
    const storyEarnings = await Promise.all(
      stories.map((story) => this.getStoryEarnings(story.id)),
    );

    return stories.map((story, index) => ({
      id: story.id,
      title: story.title,
      viewCount: story.viewCount,
      uniqueReaders: story.uniqueReaders,
      averageRating: parseFloat(story.averageRating.toString()),
      completionRate: parseFloat(story.completionRate.toString()),
      earnings: storyEarnings[index],
    }));
  }

  /**
   * Get reader engagement statistics
   */
  async getReaderStats(
    authorId: string,
    period: AnalyticsPeriod = AnalyticsPeriod.MONTH,
  ): Promise<ReaderStats> {
    const { startDate, endDate } = this.getPeriodDateRange(period);

    // Get all progress records in period
    const progress = await this.progressRepository
      .createQueryBuilder("progress")
      .innerJoin("progress.story", "story")
      .where("story.authorId = :authorId", { authorId })
      .andWhere("progress.startedAt >= :startDate", { startDate })
      .andWhere("progress.startedAt < :endDate", { endDate })
      .getMany();

    const uniqueUserIds = new Set(progress.map((p) => p.userId));
    const totalReaders = uniqueUserIds.size;

    // Get readers who were active (read more than once)
    const activeReaderIds = new Set<string>();
    const readerCounts = new Map<string, number>();

    for (const p of progress) {
      readerCounts.set(p.userId, (readerCounts.get(p.userId) || 0) + 1);
    }

    for (const [userId, count] of readerCounts.entries()) {
      if (count > 1) {
        activeReaderIds.add(userId);
      }
    }

    // Get new vs returning readers
    const previousPeriod = this.getPeriodDateRange(period);
    previousPeriod.endDate = startDate;
    previousPeriod.startDate.setTime(
      startDate.getTime() - (endDate.getTime() - startDate.getTime()),
    );

    const previousReaders = await this.progressRepository
      .createQueryBuilder("progress")
      .innerJoin("progress.story", "story")
      .select("DISTINCT progress.userId", "userId")
      .where("story.authorId = :authorId", { authorId })
      .andWhere("progress.startedAt >= :startDate", {
        startDate: previousPeriod.startDate,
      })
      .andWhere("progress.startedAt < :endDate", {
        endDate: previousPeriod.endDate,
      })
      .getRawMany();

    const previousReaderIds = new Set(previousReaders.map((r) => r.userId));
    let newReaders = 0;
    let returningReaders = 0;

    for (const userId of uniqueUserIds) {
      if (previousReaderIds.has(userId)) {
        returningReaders++;
      } else {
        newReaders++;
      }
    }

    // Calculate average session duration
    const avgSessionDuration =
      progress.length > 0
        ? progress.reduce((sum, p) => sum + p.totalReadTime, 0) /
          progress.length
        : 0;

    // Calculate average stories per reader
    const avgStoriesPerReader =
      totalReaders > 0 ? progress.length / totalReaders : 0;

    // Calculate retention rate
    const retentionRate =
      previousReaderIds.size > 0
        ? (returningReaders / previousReaderIds.size) * 100
        : 0;

    // Get engagement by day
    const engagementByDay = await this.getAuthorEngagementByDay(
      authorId,
      startDate,
      endDate,
    );

    return {
      totalReaders,
      activeReaders: activeReaderIds.size,
      newReaders,
      returningReaders,
      avgSessionDuration,
      avgStoriesPerReader,
      retentionRate,
      engagementByDay,
    };
  }

  /**
   * Get engagement by day for all author's stories
   */
  private async getAuthorEngagementByDay(
    authorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<EngagementPoint[]> {
    // Get daily reads
    const reads = await this.progressRepository
      .createQueryBuilder("progress")
      .innerJoin("progress.story", "story")
      .select("DATE(progress.startedAt AT TIME ZONE 'UTC')", "date")
      .addSelect("COUNT(*)", "reads")
      .addSelect("COUNT(DISTINCT progress.userId)", "uniqueReaders")
      .where("story.authorId = :authorId", { authorId })
      .andWhere("progress.startedAt >= :startDate", { startDate })
      .andWhere("progress.startedAt < :endDate", { endDate })
      .groupBy("date")
      .orderBy("date", "ASC")
      .getRawMany();

    // Get daily completions
    const completions = await this.progressRepository
      .createQueryBuilder("progress")
      .innerJoin("progress.story", "story")
      .select("DATE(progress.completedAt AT TIME ZONE 'UTC')", "date")
      .addSelect("COUNT(*)", "completions")
      .where("story.authorId = :authorId", { authorId })
      .andWhere("progress.isCompleted = true")
      .andWhere("progress.completedAt >= :startDate", { startDate })
      .andWhere("progress.completedAt < :endDate", { endDate })
      .groupBy("date")
      .orderBy("date", "ASC")
      .getRawMany();

    // Get daily comments
    const comments = await this.commentRepository
      .createQueryBuilder("comment")
      .innerJoin("comment.story", "story")
      .select("DATE(comment.createdAt AT TIME ZONE 'UTC')", "date")
      .addSelect("COUNT(*)", "comments")
      .where("story.authorId = :authorId", { authorId })
      .andWhere("comment.createdAt >= :startDate", { startDate })
      .andWhere("comment.createdAt < :endDate", { endDate })
      .groupBy("date")
      .orderBy("date", "ASC")
      .getRawMany();

    // Get daily ratings
    const ratings = await this.ratingRepository
      .createQueryBuilder("rating")
      .innerJoin("rating.story", "story")
      .select("DATE(rating.createdAt AT TIME ZONE 'UTC')", "date")
      .addSelect("COUNT(*)", "ratings")
      .where("story.authorId = :authorId", { authorId })
      .andWhere("rating.createdAt >= :startDate", { startDate })
      .andWhere("rating.createdAt < :endDate", { endDate })
      .groupBy("date")
      .orderBy("date", "ASC")
      .getRawMany();

    // Get daily earnings
    const earnings = await this.transactionRepository
      .createQueryBuilder("txn")
      .select("DATE(txn.createdAt AT TIME ZONE 'UTC')", "date")
      .addSelect("SUM(txn.amount)", "earnings")
      .where("txn.userId = :authorId", { authorId })
      .andWhere("txn.type IN ('STORY_EARNINGS', 'AD_REWARD')")
      .andWhere("txn.amount > 0")
      .andWhere("txn.createdAt >= :startDate", { startDate })
      .andWhere("txn.createdAt < :endDate", { endDate })
      .groupBy("date")
      .orderBy("date", "ASC")
      .getRawMany();

    // Merge all data by date
    const dataMap = new Map<string, EngagementPoint>();

    for (const read of reads) {
      dataMap.set(read.date, {
        date: read.date,
        reads: parseInt(read.reads),
        uniqueReaders: parseInt(read.uniqueReaders),
        completions: 0,
        comments: 0,
        ratings: 0,
        earnings: 0,
      });
    }

    for (const completion of completions) {
      const existing = dataMap.get(completion.date) || {
        date: completion.date,
        reads: 0,
        uniqueReaders: 0,
        completions: 0,
        comments: 0,
        ratings: 0,
        earnings: 0,
      };
      existing.completions = parseInt(completion.completions);
      dataMap.set(completion.date, existing);
    }

    for (const comment of comments) {
      const existing = dataMap.get(comment.date) || {
        date: comment.date,
        reads: 0,
        uniqueReaders: 0,
        completions: 0,
        comments: 0,
        ratings: 0,
        earnings: 0,
      };
      existing.comments = parseInt(comment.comments);
      dataMap.set(comment.date, existing);
    }

    for (const rating of ratings) {
      const existing = dataMap.get(rating.date) || {
        date: rating.date,
        reads: 0,
        uniqueReaders: 0,
        completions: 0,
        comments: 0,
        ratings: 0,
        earnings: 0,
      };
      existing.ratings = parseInt(rating.ratings);
      dataMap.set(rating.date, existing);
    }

    for (const earning of earnings) {
      const existing = dataMap.get(earning.date) || {
        date: earning.date,
        reads: 0,
        uniqueReaders: 0,
        completions: 0,
        comments: 0,
        ratings: 0,
        earnings: 0,
      };
      existing.earnings = parseFloat(earning.earnings);
      dataMap.set(earning.date, existing);
    }

    return Array.from(dataMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }

  /**
   * Get earnings breakdown
   */
  async getEarningsBreakdown(
    authorId: string,
    period: AnalyticsPeriod = AnalyticsPeriod.MONTH,
  ): Promise<EarningsBreakdown> {
    const { startDate, endDate } = this.getPeriodDateRange(period);

    // Get all transactions in period
    const transactions = await this.transactionRepository
      .createQueryBuilder("txn")
      .where("txn.userId = :authorId", { authorId })
      .andWhere("txn.createdAt >= :startDate", { startDate })
      .andWhere("txn.createdAt < :endDate", { endDate })
      .andWhere("txn.type IN ('STORY_EARNINGS', 'AD_REWARD')")
      .andWhere("txn.amount > 0")
      .orderBy("txn.createdAt", "DESC")
      .getMany();

    const feeRate = PLATFORM_FEE_PERCENTAGE / 100;
    const authorRate = 1 - feeRate;
    const totalGross = transactions.reduce((sum, txn) => sum + txn.amount, 0);
    const totalFees = totalGross * feeRate;
    const totalNet = totalGross * authorRate;

    // Group by story
    const byStoryMap = new Map<string, StoryEarnings>();

    for (const txn of transactions) {
      if (txn.referenceType === "story" && txn.referenceId) {
        const existing = byStoryMap.get(txn.referenceId) || {
          storyId: txn.referenceId,
          storyTitle: "",
          gross: 0,
          fees: 0,
          net: 0,
          transactionCount: 0,
        };

        existing.gross += txn.amount;
        existing.fees += txn.amount * feeRate;
        existing.net += txn.amount * authorRate;
        existing.transactionCount++;

        byStoryMap.set(txn.referenceId, existing);
      }
    }

    // Fetch story titles
    const storyIds = Array.from(byStoryMap.keys());
    if (storyIds.length > 0) {
      const stories = await this.storyRepository
        .createQueryBuilder("story")
        .where("story.id IN (:...storyIds)", { storyIds })
        .getMany();

      for (const story of stories) {
        const earnings = byStoryMap.get(story.id);
        if (earnings) {
          earnings.storyTitle = story.title;
        }
      }
    }

    const byStory = Array.from(byStoryMap.values()).sort(
      (a, b) => b.gross - a.gross,
    );

    // Group by type
    const byTypeMap = new Map<string, TypeEarnings>();

    for (const txn of transactions) {
      const type = txn.type;
      const existing = byTypeMap.get(type) || {
        type,
        gross: 0,
        fees: 0,
        net: 0,
        count: 0,
      };

      existing.gross += txn.amount;
      existing.fees += txn.amount * 0.1;
      existing.net += txn.amount * 0.9;
      existing.count++;

      byTypeMap.set(type, existing);
    }

    const byType = Array.from(byTypeMap.values());

    // Group by period (daily for week/month, monthly for year, yearly for all)
    const byPeriod: PeriodEarnings[] = [];
    const periodMap = new Map<string, PeriodEarnings>();

    for (const txn of transactions) {
      let periodKey: string;

      if (
        period === AnalyticsPeriod.DAY ||
        period === AnalyticsPeriod.WEEK ||
        period === AnalyticsPeriod.MONTH
      ) {
        periodKey = txn.createdAt.toISOString().split("T")[0];
      } else if (period === AnalyticsPeriod.YEAR) {
        const date = new Date(txn.createdAt);
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      } else {
        const date = new Date(txn.createdAt);
        periodKey = `${date.getFullYear()}`;
      }

      const existing = periodMap.get(periodKey) || {
        period: periodKey,
        gross: 0,
        fees: 0,
        net: 0,
        count: 0,
      };

      existing.gross += txn.amount;
      existing.fees += txn.amount * 0.1;
      existing.net += txn.amount * 0.9;
      existing.count++;

      periodMap.set(periodKey, existing);
    }

    byPeriod.push(
      ...Array.from(periodMap.values()).sort((a, b) =>
        a.period.localeCompare(b.period),
      ),
    );

    return {
      totalGross,
      totalFees,
      totalNet,
      byStory,
      byType,
      byPeriod,
    };
  }

  /**
   * Get branch popularity for a story
   */
  async getBranchPopularity(
    storyId: string,
    authorId: string,
  ): Promise<BranchPopularity[]> {
    await this.verifyStoryOwnership(storyId, authorId);

    // Get all segments with their choices
    const segments = await this.segmentRepository
      .createQueryBuilder("segment")
      .leftJoinAndSelect("segment.choices", "choice")
      .leftJoinAndSelect("choice.nextSegment", "nextSegment")
      .where("segment.storyId = :storyId", { storyId })
      .orderBy("segment.createdAt", "ASC")
      .getMany();

    const result: BranchPopularity[] = [];

    for (const segment of segments) {
      if (segment.choices.length === 0) continue;

      const totalReads = segment.choices.reduce(
        (sum, choice) => sum + choice.timesChosen,
        0,
      );

      const branches: BranchChoice[] = segment.choices.map((choice) => ({
        choiceId: choice.id,
        choiceText: choice.choiceText,
        nextSegmentId: choice.nextSegmentId,
        timesSelected: choice.timesChosen,
        percentage:
          totalReads > 0 ? (choice.timesChosen / totalReads) * 100 : 0,
      }));

      result.push({
        segmentId: segment.id,
        segmentTitle: segment.title,
        totalReads,
        branches,
      });
    }

    return result;
  }

  /**
   * Get completion funnel showing reader drop-off
   */
  async getCompletionFunnel(
    storyId: string,
    authorId: string,
  ): Promise<CompletionFunnel> {
    const _story = await this.verifyStoryOwnership(storyId, authorId);

    // Get all progress records for this story
    const progressRecords = await this.progressRepository
      .createQueryBuilder("progress")
      .where("progress.storyId = :storyId", { storyId })
      .getMany();

    const totalStarts = progressRecords.length;
    const totalCompletions = progressRecords.filter(
      (p) => p.isCompleted,
    ).length;
    const completionRate =
      totalStarts > 0 ? (totalCompletions / totalStarts) * 100 : 0;

    // Get all segments ordered by their logical flow
    const segments = await this.segmentRepository
      .createQueryBuilder("segment")
      .where("segment.storyId = :storyId", { storyId })
      .orderBy("segment.readCount", "DESC")
      .getMany();

    // Calculate retention for each segment
    const segmentStats = new Map<
      string,
      { reads: number; totalTime: number }
    >();

    for (const progress of progressRecords) {
      for (const segmentId of progress.visitedSegmentIds) {
        const existing = segmentStats.get(segmentId) || {
          reads: 0,
          totalTime: 0,
        };
        existing.reads++;
        segmentStats.set(segmentId, existing);
      }
    }

    const funnelSegments: FunnelSegment[] = segments.map((segment, index) => {
      const stats = segmentStats.get(segment.id) || { reads: 0, totalTime: 0 };
      const readCount = stats.reads;
      const retentionRate =
        totalStarts > 0 ? (readCount / totalStarts) * 100 : 0;

      return {
        segmentId: segment.id,
        title: segment.title,
        order: index + 1,
        readCount,
        retentionRate,
        avgTimeSpent: segment.estimatedReadTime,
      };
    });

    // Find dropoff points (segments where retention drops significantly)
    const dropoffPoints: DropoffPoint[] = [];

    for (let i = 1; i < funnelSegments.length; i++) {
      const current = funnelSegments[i];
      const previous = funnelSegments[i - 1];

      if (previous.readCount > 0) {
        const dropoff = previous.readCount - current.readCount;
        const dropoffRate = (dropoff / previous.readCount) * 100;

        if (dropoffRate > 20) {
          // Significant dropoff (>20%)
          dropoffPoints.push({
            segmentId: current.segmentId,
            title: current.title,
            dropoffCount: dropoff,
            dropoffRate,
          });
        }
      }
    }

    // Calculate average segments read
    const totalSegmentsRead = progressRecords.reduce(
      (sum, p) => sum + p.visitedSegmentIds.length,
      0,
    );
    const avgSegmentsRead =
      totalStarts > 0 ? totalSegmentsRead / totalStarts : 0;

    return {
      totalStarts,
      totalCompletions,
      completionRate,
      segments: funnelSegments,
      avgSegmentsRead,
      dropoffPoints,
    };
  }

  /**
   * Get engagement trends over a date range
   */
  async getEngagementTrends(
    authorId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<EngagementTrends> {
    // Default to last 30 days if not specified
    if (!endDate) {
      endDate = new Date();
    }
    if (!startDate) {
      startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);
    }

    const days = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    const data = await this.getAuthorEngagementByDay(
      authorId,
      startDate,
      endDate,
    );

    // Calculate summary stats
    const totalReads = data.reduce((sum, d) => sum + d.reads, 0);
    const totalEarnings = data.reduce((sum, d) => sum + d.earnings, 0);
    const avgDailyReads = days > 0 ? totalReads / days : 0;
    const avgDailyEarnings = days > 0 ? totalEarnings / days : 0;

    // Find peak day
    let peakDay = data[0]?.date || "";
    let peakReads = data[0]?.reads || 0;

    for (const point of data) {
      if (point.reads > peakReads) {
        peakDay = point.date;
        peakReads = point.reads;
      }
    }

    return {
      period: {
        start: startDate,
        end: endDate,
        days,
      },
      data,
      summary: {
        totalReads,
        avgDailyReads,
        peakDay,
        peakReads,
        totalEarnings,
        avgDailyEarnings,
      },
    };
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(
    authorId: string,
    type: "dashboard" | "stories" | "earnings" | "readers",
    format: ExportFormatType = "json",
  ): Promise<ExportResult> {
    let data: any;

    switch (type) {
      case "dashboard":
        data = await this.getAuthorDashboard(authorId);
        break;
      case "stories":
        data = await this.getTopStories(authorId, 100);
        break;
      case "earnings":
        data = await this.getEarningsBreakdown(authorId, AnalyticsPeriod.ALL);
        break;
      case "readers":
        data = await this.getReaderStats(authorId, AnalyticsPeriod.ALL);
        break;
      default:
        data = await this.getAuthorDashboard(authorId);
    }

    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `aardvark-analytics-${type}-${timestamp}.${format}`;

    if (format === "json") {
      return {
        format: "json",
        data: JSON.stringify(data, null, 2),
        filename,
        contentType: "application/json",
      };
    } else {
      // CSV export
      const csv = this.convertToCSV(data, type);
      return {
        format: "csv",
        data: csv,
        filename,
        contentType: "text/csv",
      };
    }
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any, type: string): string {
    const lines: string[] = [];

    if (type === "stories" && Array.isArray(data)) {
      lines.push(
        "ID,Title,View Count,Unique Readers,Average Rating,Completion Rate,Earnings",
      );
      for (const story of data) {
        lines.push(
          `"${story.id}","${story.title}",${story.viewCount},${story.uniqueReaders},${story.averageRating},${story.completionRate},${story.earnings}`,
        );
      }
    } else if (type === "earnings" && data.byStory) {
      lines.push("Story ID,Story Title,Gross,Fees,Net,Transaction Count");
      for (const story of data.byStory) {
        lines.push(
          `"${story.storyId}","${story.storyTitle}",${story.gross},${story.fees},${story.net},${story.transactionCount}`,
        );
      }
    } else {
      // Generic CSV conversion
      lines.push(JSON.stringify(data));
    }

    return lines.join("\n");
  }
}
