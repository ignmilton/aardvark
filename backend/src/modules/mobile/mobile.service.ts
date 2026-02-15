import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, MoreThan } from "typeorm";
import {
  PushSubscription,
  ReaderProgress,
  Story,
  User,
  Subscription,
} from "@/database/entities";
import {
  RegisterPushTokenDto,
  SyncRequestDto,
  OfflineProgressDto,
  VerifyIosReceiptDto,
  VerifyAndroidReceiptDto,
} from "./dto";

@Injectable()
export class MobileService {
  constructor(
    @InjectRepository(PushSubscription)
    private readonly pushRepo: Repository<PushSubscription>,
    @InjectRepository(ReaderProgress)
    private readonly progressRepo: Repository<ReaderProgress>,
    @InjectRepository(Story)
    private readonly storyRepo: Repository<Story>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  /**
   * Register a push notification token for a user
   */
  async registerPushToken(userId: string, dto: RegisterPushTokenDto) {
    // Check if token already exists
    let subscription = await this.pushRepo.findOne({
      where: { userId, token: dto.token },
    });

    if (subscription) {
      // Update existing
      subscription.platform = dto.platform;
      subscription.deviceId = dto.deviceId || subscription.deviceId;
      subscription.isActive = true;
    } else {
      // Create new
      subscription = this.pushRepo.create({
        userId,
        token: dto.token,
        platform: dto.platform,
        deviceId: dto.deviceId,
        isActive: true,
      });
    }

    await this.pushRepo.save(subscription);

    return { success: true, message: "Push token registered" };
  }

  /**
   * Unregister a push notification token
   */
  async unregisterPushToken(userId: string, token: string) {
    const subscription = await this.pushRepo.findOne({
      where: { userId, token },
    });

    if (subscription) {
      subscription.isActive = false;
      await this.pushRepo.save(subscription);
    }

    return { success: true, message: "Push token unregistered" };
  }

  /**
   * Sync offline reading progress
   */
  async syncProgress(userId: string, dto: SyncRequestDto) {
    const { lastSyncAt, storyIds } = dto;

    // Get user's progress that was updated after last sync
    const qb = this.progressRepo
      .createQueryBuilder("progress")
      .leftJoinAndSelect("progress.story", "story")
      .where("progress.userId = :userId", { userId });

    if (lastSyncAt) {
      qb.andWhere("progress.updatedAt > :lastSyncAt", {
        lastSyncAt: new Date(lastSyncAt),
      });
    }

    if (storyIds && storyIds.length > 0) {
      qb.andWhere("progress.storyId IN (:...storyIds)", { storyIds });
    }

    const progress = await qb.getMany();

    // Get stories that were updated (for content sync)
    const updatedStories = lastSyncAt
      ? await this.storyRepo.find({
          where: {
            updatedAt: MoreThan(new Date(lastSyncAt)),
            ...(storyIds?.length ? { id: In(storyIds) } : {}),
          },
          select: ["id", "title", "updatedAt"],
        })
      : [];

    return {
      syncedAt: new Date().toISOString(),
      progress: progress.map((p) => ({
        storyId: p.storyId,
        currentSegmentId: p.currentSegmentId,
        visitedSegmentIds: p.visitedSegmentIds,
        choiceHistory: p.choiceHistory,
        lastReadAt: p.lastReadAt,
        isCompleted: p.isCompleted,
      })),
      updatedStories: updatedStories.map((s) => ({
        id: s.id,
        title: s.title,
        updatedAt: s.updatedAt,
      })),
    };
  }

  /**
   * Upload offline progress to server
   */
  async uploadProgress(userId: string, offlineProgress: OfflineProgressDto[]) {
    const results = [];

    for (const item of offlineProgress) {
      // Verify story exists
      const story = await this.storyRepo.findOne({
        where: { id: item.storyId },
      });
      if (!story) {
        results.push({
          storyId: item.storyId,
          status: "error",
          message: "Story not found",
        });
        continue;
      }

      // Find or create progress
      let progress = await this.progressRepo.findOne({
        where: { userId, storyId: item.storyId },
      });

      if (progress) {
        // Only update if offline data is newer
        const offlineTime = new Date(item.lastReadAt);
        if (offlineTime > progress.lastReadAt) {
          progress.currentSegmentId = item.currentSegmentId;
          progress.visitedSegmentIds = item.visitedSegmentIds;
          progress.choiceHistory =
            item.choiceHistory?.map((c) => ({
              ...c,
              timestamp: new Date(c.timestamp),
            })) || progress.choiceHistory;
          progress.lastReadAt = offlineTime;
        }
      } else {
        progress = this.progressRepo.create({
          userId,
          storyId: item.storyId,
          currentSegmentId: item.currentSegmentId,
          visitedSegmentIds: item.visitedSegmentIds,
          choiceHistory:
            item.choiceHistory?.map((c) => ({
              ...c,
              timestamp: new Date(c.timestamp),
            })) || [],
          startedAt: new Date(),
          lastReadAt: new Date(item.lastReadAt),
        });
      }

      await this.progressRepo.save(progress);
      results.push({ storyId: item.storyId, status: "synced" });
    }

    return {
      syncedAt: new Date().toISOString(),
      results,
    };
  }

  /**
   * Verify iOS App Store receipt
   * NOTE: This is a placeholder - actual implementation requires App Store Connect API
   */
  async verifyIosReceipt(_userId: string, _dto: VerifyIosReceiptDto) {
    // In production, you would:
    // 1. Call Apple's verifyReceipt endpoint
    // 2. Validate the response
    // 3. Create/update subscription record

    // For now, return a placeholder response
    // TODO: Implement actual App Store receipt verification
    return {
      success: false,
      message:
        "iOS receipt verification not yet implemented. Please use web subscription.",
      verified: false,
    };
  }

  /**
   * Verify Android Google Play receipt
   * NOTE: This is a placeholder - actual implementation requires Google Play API
   */
  async verifyAndroidReceipt(_userId: string, _dto: VerifyAndroidReceiptDto) {
    // In production, you would:
    // 1. Use Google Play Developer API to verify purchase
    // 2. Validate the subscription status
    // 3. Create/update subscription record

    // For now, return a placeholder response
    // TODO: Implement actual Google Play receipt verification
    return {
      success: false,
      message:
        "Android receipt verification not yet implemented. Please use web subscription.",
      verified: false,
    };
  }

  /**
   * Get user's push notification settings
   */
  async getPushSettings(userId: string) {
    const subscriptions = await this.pushRepo.find({
      where: { userId, isActive: true },
      select: ["id", "platform", "deviceId", "createdAt"],
    });

    return {
      hasActiveTokens: subscriptions.length > 0,
      devices: subscriptions.map((s) => ({
        id: s.id,
        platform: s.platform,
        deviceId: s.deviceId,
        registeredAt: s.createdAt,
      })),
    };
  }
}
