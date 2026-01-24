import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import { CancelSubscriptionDto } from './dto';

/**
 * Controller for subscription management.
 */
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * Get available subscription plans
   * GET /subscriptions/plans
   */
  @Get('plans')
  async getPlans() {
    const plans = await this.subscriptionsService.getPlans();
    return {
      success: true,
      data: plans.map((plan) => ({
        id: plan.id,
        tier: plan.tier,
        interval: plan.interval,
        name: plan.name,
        description: plan.description,
        priceInCents: plan.priceInCents,
        currency: plan.currency,
        features: plan.features,
      })),
    };
  }

  /**
   * Get current subscription status
   * GET /subscriptions/status
   */
  @Get('status')
  async getStatus(@Req() req: any) {
    const userId = req.user.id;
    const status = await this.subscriptionsService.getSubscriptionStatus(userId);
    return {
      success: true,
      data: {
        isActive: status.isActive,
        tier: status.tier,
        plan: status.plan
          ? {
              id: status.plan.id,
              name: status.plan.name,
              interval: status.plan.interval,
            }
          : null,
        benefits: status.benefits,
        renewsAt: status.renewsAt,
        canceledAt: status.canceledAt,
        cancelAtPeriodEnd: status.subscription?.cancelAtPeriodEnd || false,
      },
    };
  }

  /**
   * Check if user has premium access
   * GET /subscriptions/premium
   */
  @Get('premium')
  async checkPremium(@Req() req: any) {
    const userId = req.user.id;
    const isPremium = await this.subscriptionsService.isPremium(userId);
    return {
      success: true,
      data: { isPremium },
    };
  }

  /**
   * Cancel current subscription
   * POST /subscriptions/cancel
   */
  @Post('cancel')
  async cancel(
    @Req() req: any,
    @Body() dto: CancelSubscriptionDto,
  ) {
    const userId = req.user.id;
    const subscription = await this.subscriptionsService.cancelSubscription(
      userId,
      dto.cancelImmediately,
    );
    return {
      success: true,
      data: {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    };
  }

  /**
   * Resume a canceled subscription
   * POST /subscriptions/resume
   */
  @Post('resume')
  async resume(@Req() req: any) {
    const userId = req.user.id;
    const subscription = await this.subscriptionsService.resumeSubscription(userId);
    return {
      success: true,
      data: {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
    };
  }

  /**
   * Get subscription history
   * GET /subscriptions/history
   */
  @Get('history')
  async getHistory(@Req() req: any) {
    const userId = req.user.id;
    const history = await this.subscriptionsService.getHistory(userId);
    return {
      success: true,
      data: history.map((sub) => ({
        id: sub.id,
        plan: sub.plan
          ? {
              name: sub.plan.name,
              tier: sub.plan.tier,
            }
          : null,
        status: sub.status,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        canceledAt: sub.canceledAt,
        createdAt: sub.createdAt,
      })),
    };
  }
}
