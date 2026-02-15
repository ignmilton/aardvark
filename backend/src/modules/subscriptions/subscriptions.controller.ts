import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  Headers,
  RawBodyRequest,
  UseGuards,
  Logger,
  HttpCode,
  Inject,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { Response, Request } from "express";
import { ConfigService } from "@nestjs/config";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { Public } from "@/modules/auth/decorators/public.decorator";
import { SubscriptionsService } from "./subscriptions.service";
import { PaymentsService } from "@/modules/payments/payments.service";
import { RazorpayService } from "@/modules/payments/razorpay.service";
import { CreateSubscriptionDto, CancelSubscriptionDto } from "./dto";

const WEBHOOK_IDEMPOTENCY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Controller for subscription management.
 */
@Controller("subscriptions")
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly paymentsService: PaymentsService,
    private readonly razorpayService: RazorpayService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Get available subscription plans
   * GET /subscriptions/plans
   */
  @Public()
  @Get("plans")
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
  @UseGuards(JwtAuthGuard)
  @Get("status")
  async getStatus(@Req() req: any) {
    const userId = req.user.id;
    const status =
      await this.subscriptionsService.getSubscriptionStatus(userId);
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
  @UseGuards(JwtAuthGuard)
  @Get("premium")
  async checkPremium(@Req() req: any) {
    const userId = req.user.id;
    const isPremium = await this.subscriptionsService.isPremium(userId);
    return {
      success: true,
      data: { isPremium },
    };
  }

  /**
   * Subscribe to a plan
   * POST /subscriptions/subscribe
   */
  @UseGuards(JwtAuthGuard)
  @Post("subscribe")
  async subscribe(@Req() req: any, @Body() dto: CreateSubscriptionDto) {
    const userId = req.user.id;
    const user = req.user;

    // Get or create Stripe customer
    const customer = await this.paymentsService.getOrCreateCustomer(
      userId,
      user.email,
      user.displayName || user.username,
    );

    // Get the plan to get its Stripe price ID
    const plan = await this.subscriptionsService.getPlan(dto.planId);

    // Create subscription via Stripe
    const stripeSubscription = await this.paymentsService.createSubscription(
      customer.id,
      plan.stripePriceId,
      dto.paymentMethodId,
    );

    // Create local subscription record
    const subscription = await this.subscriptionsService.createSubscription(
      userId,
      dto.planId,
      stripeSubscription.id,
      customer.id,
    );

    return {
      success: true,
      data: {
        id: subscription.id,
        status: subscription.status,
        clientSecret: (stripeSubscription.latest_invoice as any)?.payment_intent
          ?.client_secret,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    };
  }

  /**
   * Cancel current subscription
   * POST /subscriptions/cancel
   */
  @UseGuards(JwtAuthGuard)
  @Post("cancel")
  async cancel(@Req() req: any, @Body() dto: CancelSubscriptionDto) {
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
  @UseGuards(JwtAuthGuard)
  @Post("resume")
  async resume(@Req() req: any) {
    const userId = req.user.id;
    const subscription =
      await this.subscriptionsService.resumeSubscription(userId);
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
  @UseGuards(JwtAuthGuard)
  @Get("history")
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

  // ============================================================================
  // Webhooks
  // ============================================================================

  /**
   * Handle Stripe webhooks
   * POST /subscriptions/webhook/stripe
   */
  @Public()
  @Post("webhook/stripe")
  @HttpCode(200)
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string,
    @Res() res: Response,
  ) {
    const webhookSecret = this.configService.get<string>(
      "STRIPE_WEBHOOK_SECRET",
    );

    if (!webhookSecret) {
      this.logger.error("Stripe webhook secret not configured");
      return res.status(500).json({ error: "Webhook secret not configured" });
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      return res.status(400).json({ error: "Missing request body" });
    }

    try {
      const event = this.paymentsService.constructWebhookEvent(
        rawBody,
        signature,
        webhookSecret,
      );

      this.logger.log(`Received Stripe webhook: ${event.type}`);

      // Idempotency check - prevent duplicate processing
      const idempotencyKey = `sub_webhook:${event.id}`;
      const alreadyProcessed = await this.cacheManager.get(idempotencyKey);
      if (alreadyProcessed) {
        this.logger.debug(`Subscription webhook ${event.id} already processed`);
        return res.json({ received: true });
      }
      // Mark as processing before handling to prevent TOCTOU race
      await this.cacheManager.set(
        idempotencyKey,
        true,
        WEBHOOK_IDEMPOTENCY_TTL_MS,
      );

      // Handle specific events
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated":
          await this.subscriptionsService.handleRenewal(
            (event.data.object as any).id,
          );
          break;

        case "customer.subscription.deleted":
          await this.subscriptionsService.handleExpiration(
            (event.data.object as any).id,
          );
          break;

        case "invoice.payment_succeeded":
          // Handle successful payment - subscription is already active
          this.logger.log("Invoice payment succeeded");
          break;

        case "invoice.payment_failed":
          // Handle failed payment - may need to notify user
          this.logger.warn("Invoice payment failed");
          break;

        default:
          this.logger.log(`Unhandled Stripe event: ${event.type}`);
      }

      return res.json({ received: true });
    } catch (err) {
      this.logger.error(`Stripe webhook error: ${err.message}`);
      return res.status(400).json({ error: "Webhook processing failed" });
    }
  }

  /**
   * Handle Razorpay webhooks
   * POST /subscriptions/webhook/razorpay
   */
  @Public()
  @Post("webhook/razorpay")
  @HttpCode(200)
  async handleRazorpayWebhook(
    @Req() req: Request,
    @Headers("x-razorpay-signature") signature: string,
    @Body() body: any,
    @Res() res: Response,
  ) {
    // Get raw body for signature verification
    const rawBody = JSON.stringify(body);

    if (!this.razorpayService.verifyWebhookSignature(rawBody, signature)) {
      this.logger.error("Invalid Razorpay webhook signature");
      return res.status(400).json({ error: "Invalid signature" });
    }

    try {
      const event = body.event;
      const payload = body.payload;

      this.logger.log(`Received Razorpay webhook: ${event}`);

      // Handle the webhook through the Razorpay service
      await this.razorpayService.handleWebhook(event, payload);

      return res.json({ received: true });
    } catch (err) {
      this.logger.error(`Razorpay webhook error: ${err.message}`);
      return res.status(400).json({ error: err.message });
    }
  }
}
