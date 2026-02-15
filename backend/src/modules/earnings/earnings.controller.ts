import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { EarningsService } from "./earnings.service";
import {
  RequestPayoutDto,
  SetupPayoutAccountDto,
  EarningsQueryDto,
} from "./dto";

/**
 * Controller for author earnings and payouts.
 */
@Controller("earnings")
@UseGuards(JwtAuthGuard)
export class EarningsController {
  constructor(private readonly earningsService: EarningsService) {}

  /**
   * Get earnings summary
   * GET /earnings/summary
   */
  @Get("summary")
  async getSummary(
    @Req() req: any,
    @Query("period") period?: "day" | "week" | "month" | "year" | "all_time",
  ) {
    const authorId = req.user.id;
    const summary = await this.earningsService.getSummary(authorId, period);
    return {
      success: true,
      data: summary,
    };
  }

  /**
   * Get pending balance
   * GET /earnings/balance
   */
  @Get("balance")
  async getBalance(@Req() req: any) {
    const authorId = req.user.id;
    const balance = await this.earningsService.getPendingBalance(authorId);
    return {
      success: true,
      data: { balance },
    };
  }

  /**
   * Get detailed earnings history
   * GET /earnings/history
   */
  @Get("history")
  async getHistory(@Req() req: any, @Query() query: EarningsQueryDto) {
    const authorId = req.user.id;
    const result = await this.earningsService.getEarnings(authorId, query);
    return {
      success: true,
      data: result.earnings.map((e) => ({
        id: e.id,
        type: e.type,
        story: e.story ? { id: e.story.id, title: e.story.title } : null,
        grossAmount: e.grossAmount,
        platformFee: e.platformFee,
        netAmount: e.netAmount,
        reader: e.reader ? { username: e.reader.username } : null,
        createdAt: e.createdAt,
      })),
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  /**
   * Get earnings by story
   * GET /earnings/by-story
   */
  @Get("by-story")
  async getByStory(
    @Req() req: any,
    @Query("period") period?: "day" | "week" | "month" | "year" | "all_time",
  ) {
    const authorId = req.user.id;
    const earnings = await this.earningsService.getEarningsByStory(
      authorId,
      period,
    );
    return {
      success: true,
      data: earnings,
    };
  }

  // ============================================================================
  // Payout Account
  // ============================================================================

  /**
   * Get payout account status
   * GET /earnings/payout-account
   */
  @Get("payout-account")
  async getPayoutAccount(@Req() req: any) {
    const authorId = req.user.id;
    const account = await this.earningsService.getPayoutAccount(authorId);

    if (!account) {
      return {
        success: true,
        data: null,
      };
    }

    return {
      success: true,
      data: {
        id: account.id,
        status: account.accountStatus,
        chargesEnabled: account.chargesEnabled,
        payoutsEnabled: account.payoutsEnabled,
        country: account.country,
        currency: account.currency,
      },
    };
  }

  /**
   * Set up payout account
   * POST /earnings/payout-account/setup
   */
  @Post("payout-account/setup")
  async setupPayoutAccount(
    @Req() req: any,
    @Body() dto: SetupPayoutAccountDto,
  ) {
    const authorId = req.user.id;
    const result = await this.earningsService.setupPayoutAccount(
      authorId,
      dto.country,
      dto.businessType,
      dto.returnUrl,
      dto.refreshUrl,
    );
    return {
      success: true,
      data: result,
    };
  }

  // ============================================================================
  // Payouts
  // ============================================================================

  /**
   * Request a payout
   * POST /earnings/payout
   */
  @Post("payout")
  async requestPayout(@Req() req: any, @Body() dto: RequestPayoutDto) {
    const authorId = req.user.id;
    const payout = await this.earningsService.requestPayout(
      authorId,
      dto.amount,
    );
    return {
      success: true,
      data: {
        id: payout.id,
        amount: payout.amount,
        status: payout.status,
        requestedAt: payout.requestedAt,
      },
    };
  }

  /**
   * Get payout history
   * GET /earnings/payouts
   */
  @Get("payouts")
  async getPayoutHistory(@Req() req: any) {
    const authorId = req.user.id;
    const payouts = await this.earningsService.getPayoutHistory(authorId);
    return {
      success: true,
      data: payouts.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        failureReason: p.failureReason,
        requestedAt: p.requestedAt,
        processedAt: p.processedAt,
        completedAt: p.completedAt,
      })),
    };
  }
}
