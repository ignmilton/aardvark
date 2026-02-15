import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Impression,
  ImpressionType,
  AuthorRevenue,
  PayoutStatus,
} from "@/database/entities/impression.entity";
import { Story, User } from "@/database/entities";
import {
  RecordImpressionDto,
  ImpressionQueryDto,
  RevenueQueryDto,
} from "./dto";

// Default revenue share: 70% to author, 30% to platform
const DEFAULT_REVENUE_SHARE_PERCENT = 70;

@Injectable()
export class ImpressionsService {
  constructor(
    @InjectRepository(Impression)
    private readonly impressionRepo: Repository<Impression>,
    @InjectRepository(AuthorRevenue)
    private readonly revenueRepo: Repository<AuthorRevenue>,
    @InjectRepository(Story)
    private readonly storyRepo: Repository<Story>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Record a new impression
   */
  async recordImpression(
    dto: RecordImpressionDto,
    userId?: string,
    metadata?: { userAgent?: string; ipAddress?: string; countryCode?: string },
  ): Promise<Impression> {
    // Verify story exists
    const story = await this.storyRepo.findOne({ where: { id: dto.storyId } });
    if (!story) {
      throw new NotFoundException("Story not found");
    }

    // Determine if this impression is revenue eligible
    // (e.g., not from the author themselves, completed reads, etc.)
    const isRevenueEligible = this.checkRevenueEligibility(dto, userId, story);

    const impression = this.impressionRepo.create({
      storyId: dto.storyId,
      userId: userId || null,
      sessionId: dto.sessionId || null,
      type: dto.type,
      segmentId: dto.segmentId || null,
      durationSeconds: dto.durationSeconds || null,
      isRevenueEligible,
      userAgent: metadata?.userAgent || null,
      ipAddress: metadata?.ipAddress || null,
      countryCode: metadata?.countryCode || null,
    });

    const saved = await this.impressionRepo.save(impression);

    // Update story view count for VIEW type
    if (dto.type === ImpressionType.VIEW) {
      await this.storyRepo.increment({ id: dto.storyId }, "viewCount", 1);
    }

    return saved;
  }

  /**
   * Check if impression qualifies for revenue sharing
   */
  private checkRevenueEligibility(
    dto: RecordImpressionDto,
    userId: string | undefined,
    story: Story,
  ): boolean {
    // Author reading their own story doesn't generate revenue
    if (userId && userId === story.authorId) {
      return false;
    }

    // Only completed reads or significant segment reads qualify
    if (dto.type === ImpressionType.READ_COMPLETE) {
      return true;
    }

    if (
      dto.type === ImpressionType.READ_SEGMENT &&
      dto.durationSeconds &&
      dto.durationSeconds >= 30
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get impressions with filtering
   */
  async getImpressions(query: ImpressionQueryDto) {
    const { page = 1, limit = 50, storyId, type, startDate, endDate } = query;

    const qb = this.impressionRepo.createQueryBuilder("impression");

    if (storyId) {
      qb.andWhere("impression.storyId = :storyId", { storyId });
    }

    if (type) {
      qb.andWhere("impression.type = :type", { type });
    }

    if (startDate) {
      qb.andWhere("impression.createdAt >= :startDate", {
        startDate: new Date(startDate),
      });
    }

    if (endDate) {
      qb.andWhere("impression.createdAt <= :endDate", {
        endDate: new Date(endDate),
      });
    }

    const [items, total] = await qb
      .orderBy("impression.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get impression statistics for a story
   */
  async getStoryStats(storyId: string, startDate?: Date, endDate?: Date) {
    const qb = this.impressionRepo
      .createQueryBuilder("impression")
      .where("impression.storyId = :storyId", { storyId });

    if (startDate) {
      qb.andWhere("impression.createdAt >= :startDate", { startDate });
    }

    if (endDate) {
      qb.andWhere("impression.createdAt <= :endDate", { endDate });
    }

    const stats = await qb
      .select("impression.type", "type")
      .addSelect("COUNT(*)", "count")
      .addSelect("COUNT(DISTINCT impression.userId)", "uniqueUsers")
      .groupBy("impression.type")
      .getRawMany();

    const totalViews =
      stats.find((s) => s.type === ImpressionType.VIEW)?.count || 0;
    const totalReads =
      stats.find((s) => s.type === ImpressionType.READ_START)?.count || 0;
    const completions =
      stats.find((s) => s.type === ImpressionType.READ_COMPLETE)?.count || 0;

    return {
      totalViews: parseInt(totalViews),
      totalReads: parseInt(totalReads),
      completions: parseInt(completions),
      completionRate: totalReads > 0 ? (completions / totalReads) * 100 : 0,
      byType: stats.reduce(
        (acc, s) => {
          acc[s.type] = {
            count: parseInt(s.count),
            uniqueUsers: parseInt(s.uniqueUsers),
          };
          return acc;
        },
        {} as Record<string, { count: number; uniqueUsers: number }>,
      ),
    };
  }

  /**
   * Calculate and store author revenue for a period
   */
  async calculateRevenue(
    periodStart: Date,
    periodEnd: Date,
    totalRevenuePool: number = 0,
  ) {
    // Get all revenue-eligible impressions grouped by story
    const impressionStats = await this.impressionRepo
      .createQueryBuilder("impression")
      .innerJoin("impression.story", "story")
      .where("impression.isRevenueEligible = :eligible", { eligible: true })
      .andWhere("impression.createdAt BETWEEN :start AND :end", {
        start: periodStart,
        end: periodEnd,
      })
      .select("story.id", "storyId")
      .addSelect("story.authorId", "authorId")
      .addSelect("COUNT(*)", "totalImpressions")
      .addSelect("COUNT(DISTINCT impression.userId)", "uniqueReaders")
      .addSelect(
        "SUM(CASE WHEN impression.type = :completeType THEN 1 ELSE 0 END)",
        "completions",
      )
      .setParameter("completeType", ImpressionType.READ_COMPLETE)
      .groupBy("story.id")
      .addGroupBy("story.authorId")
      .getRawMany();

    // Calculate total impressions for proportional distribution
    const totalImpressions = impressionStats.reduce(
      (sum, s) => sum + parseInt(s.totalImpressions),
      0,
    );

    // Create or update AuthorRevenue records
    const revenueRecords: AuthorRevenue[] = [];

    for (const stat of impressionStats) {
      const impressionShare =
        parseInt(stat.totalImpressions) / totalImpressions;
      const grossRevenue = totalRevenuePool * impressionShare;
      const netRevenue = grossRevenue * (DEFAULT_REVENUE_SHARE_PERCENT / 100);

      // Check if record already exists for this period/story
      let revenue = await this.revenueRepo.findOne({
        where: {
          storyId: stat.storyId,
          periodStart,
          periodEnd,
        },
      });

      if (!revenue) {
        revenue = this.revenueRepo.create({
          authorId: stat.authorId,
          storyId: stat.storyId,
          periodStart,
          periodEnd,
        });
      }

      revenue.totalImpressions = parseInt(stat.totalImpressions);
      revenue.uniqueReaders = parseInt(stat.uniqueReaders);
      revenue.completions = parseInt(stat.completions);
      revenue.grossRevenue = grossRevenue;
      revenue.revenueSharePercent = DEFAULT_REVENUE_SHARE_PERCENT;
      revenue.netRevenue = netRevenue;
      revenue.payoutStatus = PayoutStatus.PENDING;

      revenueRecords.push(revenue);
    }

    await this.revenueRepo.save(revenueRecords);

    // Update user pending revenue
    const authorTotals = revenueRecords.reduce(
      (acc, r) => {
        acc[r.authorId] = (acc[r.authorId] || 0) + r.netRevenue;
        return acc;
      },
      {} as Record<string, number>,
    );

    for (const [authorId, amount] of Object.entries(authorTotals)) {
      await this.userRepo.increment({ id: authorId }, "pendingRevenue", amount);
    }

    return {
      periodStart,
      periodEnd,
      totalRevenuePool,
      totalImpressions,
      storiesProcessed: revenueRecords.length,
      records: revenueRecords,
    };
  }

  /**
   * Get author revenue records
   */
  async getAuthorRevenue(authorId: string, query: RevenueQueryDto) {
    const { page = 1, limit = 20, storyId, startDate, endDate } = query;

    const qb = this.revenueRepo
      .createQueryBuilder("revenue")
      .leftJoinAndSelect("revenue.story", "story")
      .where("revenue.authorId = :authorId", { authorId });

    if (storyId) {
      qb.andWhere("revenue.storyId = :storyId", { storyId });
    }

    if (startDate) {
      qb.andWhere("revenue.periodStart >= :startDate", {
        startDate: new Date(startDate),
      });
    }

    if (endDate) {
      qb.andWhere("revenue.periodEnd <= :endDate", {
        endDate: new Date(endDate),
      });
    }

    const [items, total] = await qb
      .orderBy("revenue.periodEnd", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Calculate totals
    const totals = await this.revenueRepo
      .createQueryBuilder("revenue")
      .where("revenue.authorId = :authorId", { authorId })
      .select("SUM(revenue.grossRevenue)", "totalGross")
      .addSelect("SUM(revenue.netRevenue)", "totalNet")
      .addSelect("SUM(revenue.totalImpressions)", "totalImpressions")
      .getRawOne();

    return {
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      totals: {
        grossRevenue: parseFloat(totals.totalGross) || 0,
        netRevenue: parseFloat(totals.totalNet) || 0,
        totalImpressions: parseInt(totals.totalImpressions) || 0,
      },
    };
  }

  /**
   * Get revenue summary for author dashboard
   */
  async getRevenueSummary(authorId: string) {
    const user = await this.userRepo.findOne({ where: { id: authorId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Get pending revenue by status
    const pendingRevenue = await this.revenueRepo
      .createQueryBuilder("revenue")
      .where("revenue.authorId = :authorId", { authorId })
      .andWhere("revenue.payoutStatus = :status", {
        status: PayoutStatus.PENDING,
      })
      .select("SUM(revenue.netRevenue)", "amount")
      .getRawOne();

    // Get this month's revenue
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthRevenue = await this.revenueRepo
      .createQueryBuilder("revenue")
      .where("revenue.authorId = :authorId", { authorId })
      .andWhere("revenue.periodStart >= :startOfMonth", { startOfMonth })
      .select("SUM(revenue.netRevenue)", "amount")
      .addSelect("SUM(revenue.totalImpressions)", "impressions")
      .getRawOne();

    // Get lifetime totals
    const lifetime = await this.revenueRepo
      .createQueryBuilder("revenue")
      .where("revenue.authorId = :authorId", { authorId })
      .select("SUM(revenue.netRevenue)", "earnings")
      .addSelect("SUM(revenue.totalImpressions)", "impressions")
      .addSelect("SUM(revenue.uniqueReaders)", "readers")
      .getRawOne();

    return {
      pendingRevenue: parseFloat(pendingRevenue?.amount) || 0,
      totalEarnings: parseFloat(user.totalEarnings.toString()) || 0,
      thisMonth: {
        earnings: parseFloat(thisMonthRevenue?.amount) || 0,
        impressions: parseInt(thisMonthRevenue?.impressions) || 0,
      },
      lifetime: {
        earnings: parseFloat(lifetime?.earnings) || 0,
        impressions: parseInt(lifetime?.impressions) || 0,
        readers: parseInt(lifetime?.readers) || 0,
      },
      revenueSharePercent: DEFAULT_REVENUE_SHARE_PERCENT,
    };
  }
}
