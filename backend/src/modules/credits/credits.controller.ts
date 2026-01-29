import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { randomBytes } from 'crypto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CreditsService } from './credits.service';
import {
  UnlockStoryDto,
  TipAuthorDto,
  AdWatchRewardDto,
  TransactionHistoryQueryDto,
} from './dto';

const AD_MIN_DURATION_MS = 25_000; // Minimum 25 seconds must elapse
const AD_SESSION_TTL_MS = 600_000; // 10 minute session expiry
const MAX_ADS_PER_DAY = 50; // Maximum ads a user can watch per day

/**
 * Controller for credit operations.
 * Handles balance inquiries, spending, and earning credits.
 */
@Controller('credits')
@UseGuards(JwtAuthGuard)
export class CreditsController {
  constructor(
    private readonly creditsService: CreditsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Get current credit balance
   * GET /credits/balance
   */
  @Get('balance')
  async getBalance(@Req() req: any) {
    const balance = await this.creditsService.getBalance(req.user.id);
    return { success: true, data: balance };
  }

  /**
   * Get transaction history
   * GET /credits/transactions
   */
  @Get('transactions')
  async getTransactions(
    @Req() req: any,
    @Query() query: TransactionHistoryQueryDto,
  ) {
    const result = await this.creditsService.getTransactionHistory(req.user.id, query);
    return {
      success: true,
      data: result.transactions,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  /**
   * Get available credit bundles
   * GET /credits/bundles
   */
  @Get('bundles')
  async getBundles() {
    const bundles = await this.creditsService.getBundles();
    return {
      success: true,
      data: bundles.map((bundle) => ({
        id: bundle.id,
        name: bundle.name,
        credits: bundle.credits,
        bonusCredits: bundle.bonusCredits,
        totalCredits: bundle.credits + bundle.bonusCredits,
        priceInCents: bundle.priceInCents,
        currency: bundle.currency,
        isPopular: bundle.isPopular,
      })),
    };
  }

  /**
   * Check if a story is unlocked
   * GET /credits/unlock-status?storyId=xxx
   */
  @Get('unlock-status')
  async checkUnlockStatus(
    @Req() req: any,
    @Query('storyId') storyId: string,
  ) {
    const unlocked = await this.creditsService.isStoryUnlocked(req.user.id, storyId);
    return { success: true, data: { unlocked } };
  }

  /**
   * Unlock a premium story
   * POST /credits/unlock-story
   */
  @Post('unlock-story')
  async unlockStory(
    @Req() req: any,
    @Body() dto: UnlockStoryDto,
  ) {
    const transaction = await this.creditsService.unlockStory(req.user.id, dto);
    return {
      success: true,
      data: {
        transactionId: transaction.id,
        newBalance: transaction.balance,
      },
    };
  }

  /**
   * Tip an author
   * POST /credits/tip
   */
  @Post('tip')
  async tipAuthor(
    @Req() req: any,
    @Body() dto: TipAuthorDto,
  ) {
    const transaction = await this.creditsService.tipAuthor(req.user.id, dto);
    return {
      success: true,
      data: {
        transactionId: transaction.id,
        newBalance: transaction.balance,
      },
    };
  }

  /**
   * Claim daily bonus
   * POST /credits/daily-bonus
   */
  @Post('daily-bonus')
  async claimDailyBonus(@Req() req: any) {
    const transaction = await this.creditsService.claimDailyBonus(req.user.id);
    return {
      success: true,
      data: {
        creditsAwarded: transaction.amount,
        newBalance: transaction.balance,
      },
    };
  }

  /**
   * Start an ad session (server-side verification token).
   * Client must call this before showing an ad, then submit the token
   * when claiming the reward. Server verifies minimum time elapsed.
   * Uses Redis for multi-instance support.
   * POST /credits/ad-session
   */
  @Post('ad-session')
  async startAdSession(@Req() req: any) {
    const userId = req.user.id;

    // Check daily ad limit before starting new session
    const dailyCount = await this.getDailyAdCount(userId);
    if (dailyCount >= MAX_ADS_PER_DAY) {
      throw new BadRequestException(
        `Daily ad limit reached (${MAX_ADS_PER_DAY} ads per day). Try again tomorrow.`,
      );
    }

    // Generate a cryptographically secure session token
    const sessionToken = `${userId}_${Date.now()}_${randomBytes(16).toString('hex')}`;

    // Store session in Redis with TTL
    const cacheKey = `ad_session:${sessionToken}`;
    await this.cacheManager.set(
      cacheKey,
      { userId, startedAt: Date.now() },
      AD_SESSION_TTL_MS,
    );

    return {
      success: true,
      data: { sessionToken },
    };
  }

  /**
   * Get the count of ads watched by a user today
   */
  private async getDailyAdCount(userId: string): Promise<number> {
    // Check Redis cache first for daily count
    const cacheKey = `ad_daily_count:${userId}`;
    const cached = await this.cacheManager.get<number>(cacheKey);
    if (cached !== undefined && cached !== null) {
      return cached;
    }

    // Fall back to database count
    const count = await this.creditsService.getTodayAdWatchCount(userId);

    // Cache for 5 minutes to reduce DB queries
    await this.cacheManager.set(cacheKey, count, 300_000);

    return count;
  }

  /**
   * Increment the daily ad count in cache
   */
  private async incrementDailyAdCount(userId: string): Promise<void> {
    const cacheKey = `ad_daily_count:${userId}`;
    const current = await this.cacheManager.get<number>(cacheKey) || 0;

    // Calculate TTL until end of day
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const ttlMs = endOfDay.getTime() - now.getTime();

    await this.cacheManager.set(cacheKey, current + 1, ttlMs);
  }

  /**
   * Reward for watching an ad (with server-side verification)
   * Uses Redis for session verification and enforces daily limits.
   * POST /credits/ad-reward
   */
  @Post('ad-reward')
  async rewardAdWatch(
    @Req() req: any,
    @Body() dto: AdWatchRewardDto & { sessionToken?: string },
  ) {
    const userId = req.user.id;

    // Check daily ad limit
    const dailyCount = await this.getDailyAdCount(userId);
    if (dailyCount >= MAX_ADS_PER_DAY) {
      throw new BadRequestException(
        `Daily ad limit reached (${MAX_ADS_PER_DAY} ads per day). Try again tomorrow.`,
      );
    }

    // Verify session token if provided
    if (dto.sessionToken) {
      const cacheKey = `ad_session:${dto.sessionToken}`;
      const session = await this.cacheManager.get<{ userId: string; startedAt: number }>(cacheKey);

      if (!session) {
        throw new BadRequestException('Invalid or expired ad session');
      }
      if (session.userId !== userId) {
        throw new BadRequestException('Session token mismatch');
      }

      // Verify minimum time has elapsed (prevents instant claims)
      const elapsed = Date.now() - session.startedAt;
      if (elapsed < AD_MIN_DURATION_MS) {
        throw new BadRequestException(
          'Ad not watched long enough. Please watch the full ad.',
        );
      }

      // Consume the session token (one-time use) - delete from Redis
      await this.cacheManager.del(cacheKey);
    }

    const transaction = await this.creditsService.rewardAdWatch(userId, dto);

    if (!transaction) {
      return {
        success: true,
        data: { creditsAwarded: 0, message: 'Ad not completed' },
      };
    }

    // Increment daily ad count in cache
    await this.incrementDailyAdCount(userId);

    return {
      success: true,
      data: {
        creditsAwarded: transaction.amount,
        newBalance: transaction.balance,
      },
    };
  }
}
