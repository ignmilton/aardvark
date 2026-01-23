import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CreditsService } from './credits.service';
import {
  UnlockStoryDto,
  TipAuthorDto,
  AdWatchRewardDto,
  TransactionHistoryQueryDto,
} from './dto';

// In-memory ad session store (use Redis in production for multi-instance)
const adSessions = new Map<string, { userId: string; startedAt: number }>();
const AD_MIN_DURATION_MS = 25_000; // Minimum 25 seconds must elapse

/**
 * Controller for credit operations.
 * Handles balance inquiries, spending, and earning credits.
 */
@Controller('credits')
@UseGuards(JwtAuthGuard)
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

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
   * POST /credits/ad-session
   */
  @Post('ad-session')
  async startAdSession(@Req() req: any) {
    const userId = req.user.id;

    // Generate a unique session token
    const sessionToken = `${userId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Store session with start time
    adSessions.set(sessionToken, { userId, startedAt: Date.now() });

    // Clean up old sessions (>10 min old)
    const cutoff = Date.now() - 600_000;
    for (const [key, session] of adSessions) {
      if (session.startedAt < cutoff) {
        adSessions.delete(key);
      }
    }

    return {
      success: true,
      data: { sessionToken },
    };
  }

  /**
   * Reward for watching an ad (with server-side verification)
   * POST /credits/ad-reward
   */
  @Post('ad-reward')
  async rewardAdWatch(
    @Req() req: any,
    @Body() dto: AdWatchRewardDto & { sessionToken?: string },
  ) {
    const userId = req.user.id;

    // Verify session token if provided
    if (dto.sessionToken) {
      const session = adSessions.get(dto.sessionToken);
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

      // Consume the session token (one-time use)
      adSessions.delete(dto.sessionToken);
    }

    const transaction = await this.creditsService.rewardAdWatch(userId, dto);

    if (!transaction) {
      return {
        success: true,
        data: { creditsAwarded: 0, message: 'Ad not completed' },
      };
    }

    return {
      success: true,
      data: {
        creditsAwarded: transaction.amount,
        newBalance: transaction.balance,
      },
    };
  }
}
