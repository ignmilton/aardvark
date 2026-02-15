import {
  Injectable,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, MoreThan } from "typeorm";
import { ConfigService } from "@nestjs/config";
import {
  PushSubscription,
  ReaderProgress,
  Story,
  User,
  Subscription,
  SubscriptionPlan,
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
  private readonly logger = new Logger(MobileService.name);

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
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
    private readonly configService: ConfigService,
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
   * Verify iOS App Store receipt and create/update subscription
   */
  async verifyIosReceipt(userId: string, dto: VerifyIosReceiptDto): Promise<{
    success: boolean;
    verified: boolean;
    message?: string;
    isActive?: boolean;
    expiresAt?: string;
    productId?: string;
    transactionId?: string;
  }> {
    const sharedSecret = this.configService.get<string>(
      "APPLE_SHARED_SECRET",
    );
    if (!sharedSecret) {
      throw new BadRequestException(
        "iOS receipt verification is not configured. APPLE_SHARED_SECRET is missing.",
      );
    }

    // Determine endpoint (production vs sandbox)
    const verifyUrl = dto.sandbox
      ? "https://sandbox.itunes.apple.com/verifyReceipt"
      : "https://buy.itunes.apple.com/verifyReceipt";

    try {
      const response = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "receipt-data": dto.receiptData,
          password: sharedSecret,
          "exclude-old-transactions": true,
        }),
      });

      const result = await response.json();

      // Status 21007 means sandbox receipt sent to production - retry on sandbox
      if (result.status === 21007 && !dto.sandbox) {
        return this.verifyIosReceipt(userId, { ...dto, sandbox: true });
      }

      if (result.status !== 0) {
        this.logger.warn(
          `iOS receipt verification failed for user ${userId}: status ${result.status}`,
        );
        return {
          success: false,
          verified: false,
          message: `Receipt verification failed with status ${result.status}`,
        };
      }

      // Extract latest receipt info
      const latestInfo =
        result.latest_receipt_info?.[0] || result.receipt?.in_app?.[0];

      if (!latestInfo) {
        return {
          success: false,
          verified: false,
          message: "No subscription information found in receipt",
        };
      }

      // Check if subscription is still active
      const expiresDateMs = parseInt(latestInfo.expires_date_ms, 10);
      const isActive = expiresDateMs > Date.now();
      const originalTransactionId = latestInfo.original_transaction_id;

      if (isActive) {
        await this.createOrUpdateMobileSubscription(userId, {
          platform: "ios",
          platformSubscriptionId: originalTransactionId,
          currentPeriodStart: new Date(
            parseInt(latestInfo.purchase_date_ms, 10),
          ),
          currentPeriodEnd: new Date(expiresDateMs),
          productId: latestInfo.product_id,
        });
      }

      return {
        success: true,
        verified: true,
        isActive,
        expiresAt: new Date(expiresDateMs).toISOString(),
        productId: latestInfo.product_id,
        transactionId: originalTransactionId,
      };
    } catch (error) {
      this.logger.error(
        `iOS receipt verification error for user ${userId}: ${error.message}`,
      );
      throw new BadRequestException(
        "Failed to verify iOS receipt. Please try again.",
      );
    }
  }

  /**
   * Verify Android Google Play receipt and create/update subscription
   */
  async verifyAndroidReceipt(userId: string, dto: VerifyAndroidReceiptDto) {
    const serviceAccountKey = this.configService.get<string>(
      "GOOGLE_SERVICE_ACCOUNT_KEY",
    );
    if (!serviceAccountKey) {
      throw new BadRequestException(
        "Android receipt verification is not configured. GOOGLE_SERVICE_ACCOUNT_KEY is missing.",
      );
    }

    try {
      // Get OAuth2 access token using service account
      const accessToken = await this.getGoogleAccessToken(serviceAccountKey);

      // Call Google Play Developer API to verify the subscription
      const apiUrl =
        `https://androidpublisher.googleapis.com/androidpublisher/v3` +
        `/applications/${encodeURIComponent(dto.packageName)}` +
        `/purchases/subscriptions/${encodeURIComponent(dto.productId)}` +
        `/tokens/${encodeURIComponent(dto.purchaseToken)}`;

      const response = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.warn(
          `Google Play verification failed for user ${userId}: ${response.status} ${errorBody}`,
        );
        return {
          success: false,
          verified: false,
          message: `Google Play verification failed with status ${response.status}`,
        };
      }

      const result = await response.json();

      // Check expiry
      const expiryTimeMillis = parseInt(result.expiryTimeMillis, 10);
      const isActive = expiryTimeMillis > Date.now();

      // Payment states: 0 = pending, 1 = received, 2 = free trial, 3 = deferred
      const paymentReceived =
        result.paymentState === 1 || result.paymentState === 2;

      if (isActive && paymentReceived) {
        await this.createOrUpdateMobileSubscription(userId, {
          platform: "android",
          platformSubscriptionId: dto.purchaseToken,
          currentPeriodStart: new Date(
            parseInt(result.startTimeMillis, 10),
          ),
          currentPeriodEnd: new Date(expiryTimeMillis),
          productId: dto.productId,
        });
      }

      return {
        success: true,
        verified: true,
        isActive: isActive && paymentReceived,
        expiresAt: new Date(expiryTimeMillis).toISOString(),
        productId: dto.productId,
        autoRenewing: result.autoRenewing ?? false,
      };
    } catch (error) {
      this.logger.error(
        `Android receipt verification error for user ${userId}: ${error.message}`,
      );
      throw new BadRequestException(
        "Failed to verify Android receipt. Please try again.",
      );
    }
  }

  /**
   * Create or update a mobile-originated subscription
   */
  private async createOrUpdateMobileSubscription(
    userId: string,
    params: {
      platform: "ios" | "android";
      platformSubscriptionId: string;
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
      productId: string;
    },
  ) {
    // Prevent receipt replay: check if another user already claimed this subscription
    const existingForOtherUser = await this.subscriptionRepo.findOne({
      where: {
        platformSubscriptionId: params.platformSubscriptionId,
        platform: params.platform,
      },
    });
    if (existingForOtherUser && existingForOtherUser.userId !== userId) {
      this.logger.warn(
        `Receipt replay attempt: subscription ${params.platformSubscriptionId} already belongs to another user, attempted by ${userId}`,
      );
      return;
    }

    // Find existing mobile subscription for this user on this platform
    let subscription = await this.subscriptionRepo.findOne({
      where: {
        userId,
        platform: params.platform,
      },
    });

    // Find an active plan to associate with
    const plan = await this.planRepo.findOne({
      where: { isActive: true },
      order: { priceInCents: "DESC" },
    });

    if (!plan) {
      this.logger.warn(
        `No active subscription plan found for mobile subscription (user: ${userId})`,
      );
      return;
    }

    if (subscription) {
      subscription.platformSubscriptionId = params.platformSubscriptionId;
      subscription.currentPeriodStart = params.currentPeriodStart;
      subscription.currentPeriodEnd = params.currentPeriodEnd;
      subscription.status = "active";
      subscription.cancelAtPeriodEnd = false;
      subscription.canceledAt = null;
    } else {
      subscription = this.subscriptionRepo.create({
        userId,
        planId: plan.id,
        platform: params.platform,
        platformSubscriptionId: params.platformSubscriptionId,
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        status: "active",
        currentPeriodStart: params.currentPeriodStart,
        currentPeriodEnd: params.currentPeriodEnd,
        cancelAtPeriodEnd: false,
      });
    }

    await this.subscriptionRepo.save(subscription);
    this.logger.log(
      `Mobile subscription activated for user ${userId} via ${params.platform}`,
    );
  }

  /**
   * Get a Google OAuth2 access token from a service account key
   */
  private async getGoogleAccessToken(
    serviceAccountKeyJson: string,
  ): Promise<string> {
    const serviceAccount = JSON.parse(serviceAccountKeyJson);
    const now = Math.floor(Date.now() / 1000);

    // Build JWT header and claim set
    const header = { alg: "RS256", typ: "JWT" };
    const claimSet = {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    };

    // Encode JWT using Node.js crypto for RS256 signing
    const { createSign } = await import("crypto");
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
      "base64url",
    );
    const encodedClaims = Buffer.from(JSON.stringify(claimSet)).toString(
      "base64url",
    );
    const signingInput = `${encodedHeader}.${encodedClaims}`;

    const sign = createSign("RSA-SHA256");
    sign.update(signingInput);
    const signature = sign.sign(serviceAccount.private_key, "base64url");

    const jwt = `${signingInput}.${signature}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: jwt,
        }),
      },
    );

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new Error(
        `Failed to get Google access token: ${JSON.stringify(tokenData)}`,
      );
    }

    return tokenData.access_token;
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
