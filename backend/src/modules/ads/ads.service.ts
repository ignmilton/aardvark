import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThanOrEqual, DataSource } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { AdReward, User, Transaction } from "@/database/entities";
import { TransactionType } from "@aardvark/shared";
import {
  RecordAdRewardDto,
  AdConfigResponseDto,
  DailyLimitResponseDto,
  AdRewardResponseDto,
  AdType,
} from "./dto";

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);

  // Configuration defaults
  private readonly creditsPerRewardedVideo: number;
  private readonly creditsPerInterstitial: number;
  private readonly dailyAdLimit: number;
  private readonly cooldownSeconds: number;

  constructor(
    @InjectRepository(AdReward)
    private readonly adRewardRepository: Repository<AdReward>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.creditsPerRewardedVideo = this.configService.get<number>(
      "AD_CREDITS_REWARDED_VIDEO",
      5,
    );
    this.creditsPerInterstitial = this.configService.get<number>(
      "AD_CREDITS_INTERSTITIAL",
      2,
    );
    this.dailyAdLimit = this.configService.get<number>("DAILY_AD_LIMIT", 10);
    this.cooldownSeconds = this.configService.get<number>(
      "AD_COOLDOWN_SECONDS",
      30,
    );
  }

  /**
   * Get ad configuration for the client
   */
  getConfig(): AdConfigResponseDto {
    const adsEnabled = this.configService.get<boolean>("ADS_ENABLED", true);

    return {
      enabled: adsEnabled,
      creditsPerRewardedVideo: this.creditsPerRewardedVideo,
      creditsPerInterstitial: this.creditsPerInterstitial,
      dailyLimit: this.dailyAdLimit,
      cooldownSeconds: this.cooldownSeconds,
      adUnits: {
        ios: {
          rewardedVideo: this.configService.get<string>(
            "ADMOB_IOS_REWARDED_VIDEO",
            "",
          ),
          interstitial: this.configService.get<string>(
            "ADMOB_IOS_INTERSTITIAL",
            "",
          ),
        },
        android: {
          rewardedVideo: this.configService.get<string>(
            "ADMOB_ANDROID_REWARDED_VIDEO",
            "",
          ),
          interstitial: this.configService.get<string>(
            "ADMOB_ANDROID_INTERSTITIAL",
            "",
          ),
        },
      },
    };
  }

  /**
   * Get daily ad limit status for a user
   */
  async getDailyLimit(userId: string): Promise<DailyLimitResponseDto> {
    const todayStart = this.getTodayStart();
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    // Count ads watched today
    const adsToday = await this.adRewardRepository.count({
      where: {
        userId,
        watchedAt: MoreThanOrEqual(todayStart),
      },
    });

    // Sum credits earned today
    const creditsResult = await this.adRewardRepository
      .createQueryBuilder("ar")
      .select("SUM(ar.creditsAwarded)", "total")
      .where("ar.userId = :userId", { userId })
      .andWhere("ar.watchedAt >= :todayStart", { todayStart })
      .getRawOne();

    const creditsEarnedToday = parseInt(creditsResult?.total || "0", 10);
    const remaining = Math.max(0, this.dailyAdLimit - adsToday);

    return {
      watchedToday: adsToday,
      dailyLimit: this.dailyAdLimit,
      remaining,
      canWatchMore: remaining > 0,
      creditsEarnedToday,
      resetsAt: tomorrowStart,
    };
  }

  /**
   * Record an ad watch and award credits
   */
  async recordAdReward(
    userId: string,
    dto: RecordAdRewardDto,
    ipAddress?: string,
  ): Promise<AdRewardResponseDto> {
    // Check daily limit
    const dailyStatus = await this.getDailyLimit(userId);
    if (!dailyStatus.canWatchMore) {
      throw new BadRequestException(
        "Daily ad limit reached. Try again tomorrow.",
      );
    }

    // Check cooldown
    const lastAd = await this.adRewardRepository.findOne({
      where: { userId },
      order: { watchedAt: "DESC" },
    });

    if (lastAd) {
      const secondsSinceLastAd =
        (Date.now() - lastAd.watchedAt.getTime()) / 1000;
      if (secondsSinceLastAd < this.cooldownSeconds) {
        const waitTime = Math.ceil(this.cooldownSeconds - secondsSinceLastAd);
        throw new BadRequestException(
          `Please wait ${waitTime} seconds before watching another ad.`,
        );
      }
    }

    // Determine credits to award based on ad type
    const creditsToAward =
      dto.adType === AdType.REWARDED_VIDEO
        ? this.creditsPerRewardedVideo
        : this.creditsPerInterstitial;

    // Use a transaction to ensure balance update + record creation are atomic
    const result = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const adRewardRepo = manager.getRepository(AdReward);
      const txRepo = manager.getRepository(Transaction);

      const user = await userRepo.findOne({
        where: { id: userId },
        lock: { mode: "pessimistic_write" },
      });
      if (!user) {
        throw new BadRequestException("User not found");
      }

      const newBalance = user.creditsBalance + creditsToAward;

      // Create ad reward record
      const adReward = adRewardRepo.create({
        userId,
        adProvider: dto.adProvider,
        adType: dto.adType,
        creditsAwarded: creditsToAward,
        adUnitId: dto.adUnitId || null,
        sessionId: dto.sessionId || null,
        platform: dto.platform || null,
        deviceId: dto.deviceId || null,
        ipAddress: ipAddress || null,
        verificationToken: dto.verificationToken || null,
        adMetadata: dto.adMetadata || null,
        verified: !!dto.verificationToken,
      });

      const savedAdReward = await adRewardRepo.save(adReward);

      // Update user balance
      await userRepo.update(userId, { creditsBalance: newBalance });

      // Create transaction record
      const transaction = txRepo.create({
        userId,
        type: TransactionType.AD_REWARD,
        amount: creditsToAward,
        balance: newBalance,
        description: `Earned from watching ${dto.adType} ad`,
        referenceId: savedAdReward.id,
        referenceType: "ad_reward",
      });

      await txRepo.save(transaction);

      return { newBalance, adRewardId: savedAdReward.id };
    });

    this.logger.log(
      `User ${userId} earned ${creditsToAward} credits from ${dto.adType} ad`,
    );

    return {
      success: true,
      creditsAwarded: creditsToAward,
      newBalance: result.newBalance,
      remainingAdsToday: dailyStatus.remaining - 1,
    };
  }

  /**
   * Get ad reward history for a user
   */
  async getRewardHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [rewards, total] = await this.adRewardRepository.findAndCount({
      where: { userId },
      order: { watchedAt: "DESC" },
      skip,
      take: limit,
    });

    return {
      data: rewards,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Verify an ad reward (for server-side verification)
   */
  async verifyAdReward(
    adRewardId: string,
    verificationToken: string,
  ): Promise<boolean> {
    const adReward = await this.adRewardRepository.findOne({
      where: { id: adRewardId },
    });

    if (!adReward) {
      return false;
    }

    // In production, you would verify with the ad network here
    // For now, just mark as verified if token matches
    if (adReward.verificationToken === verificationToken) {
      adReward.verified = true;
      await this.adRewardRepository.save(adReward);
      return true;
    }

    return false;
  }

  /**
   * Get start of today (UTC midnight)
   */
  private getTodayStart(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }
}
