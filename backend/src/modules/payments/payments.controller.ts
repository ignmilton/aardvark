import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  Headers,
  RawBodyRequest,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';
import { CreditsService } from '@/modules/credits/credits.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Subscription, SubscriptionPlan, CreditBundle, User, Transaction } from '@entities';
import {
  CreateCreditCheckoutDto,
  CreateSubscriptionCheckoutDto,
  CreateSetupIntentDto,
  CreateConnectAccountDto,
  CancelSubscriptionDto,
  CreateUPIOrderDto,
  VerifyUPIPaymentDto,
  SetupUPIPayoutAccountDto,
  RequestUPIPayoutDto,
} from './dto';

// Webhook idempotency key TTL: 7 days (in ms)
const WEBHOOK_IDEMPOTENCY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Controller for payment operations.
 * Handles checkout sessions, subscriptions, and webhooks.
 */
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly razorpayService: RazorpayService,
    private readonly creditsService: CreditsService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepository: Repository<SubscriptionPlan>,
    @InjectRepository(CreditBundle)
    private readonly bundleRepository: Repository<CreditBundle>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  /**
   * Create checkout session for credit bundle purchase
   * POST /payments/checkout/credits
   */
  @Post('checkout/credits')
  @UseGuards(JwtAuthGuard)
  async createCreditCheckout(
    @Req() req: any,
    @Body() dto: CreateCreditCheckoutDto,
  ) {
    const userId = req.user.id;
    const email = req.user.email;

    // Get bundle details from database
    const bundle = await this.bundleRepository.findOne({
      where: { id: dto.bundleId, isActive: true },
    });
    if (!bundle) {
      throw new NotFoundException('Credit bundle not found');
    }

    const customer = await this.paymentsService.getOrCreateCustomer(userId, email);

    const session = await this.paymentsService.createCreditCheckoutSession(
      customer.id,
      bundle.stripePriceId,
      userId,
      dto.bundleId,
      dto.successUrl,
      dto.cancelUrl,
    );

    return {
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
      },
    };
  }

  /**
   * Create checkout session for subscription
   * POST /payments/checkout/subscription
   */
  @Post('checkout/subscription')
  @UseGuards(JwtAuthGuard)
  async createSubscriptionCheckout(
    @Req() req: any,
    @Body() dto: CreateSubscriptionCheckoutDto,
  ) {
    const userId = req.user.id;
    const email = req.user.email;

    // Get plan details from database
    const plan = await this.planRepository.findOne({
      where: { id: dto.planId, isActive: true },
    });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    const customer = await this.paymentsService.getOrCreateCustomer(userId, email);

    const session = await this.paymentsService.createSubscriptionCheckoutSession(
      customer.id,
      plan.stripePriceId,
      userId,
      dto.planId,
      dto.successUrl,
      dto.cancelUrl,
    );

    return {
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
      },
    };
  }

  /**
   * Create setup intent for saving payment methods
   * POST /payments/setup-intent
   */
  @Post('setup-intent')
  @UseGuards(JwtAuthGuard)
  async createSetupIntent(
    @Req() req: any,
    @Body() dto: CreateSetupIntentDto,
  ) {
    const userId = req.user.id;
    const email = req.user.email;

    const customer = await this.paymentsService.getOrCreateCustomer(userId, email);
    const setupIntent = await this.paymentsService.createSetupIntent(customer.id);

    return {
      success: true,
      data: {
        clientSecret: setupIntent.client_secret,
      },
    };
  }

  /**
   * Get user's payment methods
   * GET /payments/payment-methods
   */
  @Get('payment-methods')
  @UseGuards(JwtAuthGuard)
  async listPaymentMethods(@Req() req: any) {
    const userId = req.user.id;
    const email = req.user.email;

    const customer = await this.paymentsService.getOrCreateCustomer(userId, email);
    const paymentMethods = await this.paymentsService.listPaymentMethods(customer.id);

    return {
      success: true,
      data: paymentMethods.map((pm) => ({
        id: pm.id,
        type: pm.type,
        card: pm.card
          ? {
              brand: pm.card.brand,
              last4: pm.card.last4,
              expMonth: pm.card.exp_month,
              expYear: pm.card.exp_year,
            }
          : null,
      })),
    };
  }

  /**
   * Remove a payment method
   * DELETE /payments/payment-methods/:id
   */
  @Delete('payment-methods/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePaymentMethod(
    @Req() req: any,
    @Param('id') paymentMethodId: string,
  ) {
    const userId = req.user.id;
    const email = req.user.email;

    // Verify the payment method belongs to the user's customer
    const customer = await this.paymentsService.getOrCreateCustomer(userId, email);
    const paymentMethods = await this.paymentsService.listPaymentMethods(customer.id);

    const ownsPaymentMethod = paymentMethods.some(pm => pm.id === paymentMethodId);
    if (!ownsPaymentMethod) {
      throw new NotFoundException('Payment method not found');
    }

    await this.paymentsService.detachPaymentMethod(paymentMethodId);
  }

  /**
   * Cancel current subscription
   * POST /payments/subscription/cancel
   */
  @Post('subscription/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelSubscription(
    @Req() req: any,
    @Body() dto: CancelSubscriptionDto,
  ) {
    const userSub = await this.subscriptionRepository.findOne({
      where: { userId: req.user.id, status: 'active' },
    });
    if (!userSub) {
      throw new NotFoundException('No active subscription found');
    }

    const subscription = await this.paymentsService.cancelSubscription(
      userSub.stripeSubscriptionId,
      dto.cancelImmediately,
    );

    // Update local record
    userSub.cancelAtPeriodEnd = subscription.cancel_at_period_end;
    if (dto.cancelImmediately) {
      userSub.status = 'canceled';
      userSub.canceledAt = new Date();
    }
    await this.subscriptionRepository.save(userSub);

    return {
      success: true,
      data: {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    };
  }

  /**
   * Resume canceled subscription
   * POST /payments/subscription/resume
   */
  @Post('subscription/resume')
  @UseGuards(JwtAuthGuard)
  async resumeSubscription(@Req() req: any) {
    const userSub = await this.subscriptionRepository.findOne({
      where: { userId: req.user.id },
      order: { createdAt: 'DESC' },
    });
    if (!userSub || !userSub.cancelAtPeriodEnd) {
      throw new NotFoundException('No cancelable subscription found');
    }

    const subscription = await this.paymentsService.resumeSubscription(
      userSub.stripeSubscriptionId,
    );

    userSub.cancelAtPeriodEnd = false;
    userSub.canceledAt = null;
    await this.subscriptionRepository.save(userSub);

    return {
      success: true,
      data: {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    };
  }

  // ============================================================================
  // Connect (Author Payouts)
  // ============================================================================

  /**
   * Create a Stripe Connect account for author payouts
   * POST /payments/connect/account
   */
  @Post('connect/account')
  @UseGuards(JwtAuthGuard)
  async createConnectAccount(
    @Req() req: any,
    @Body() dto: CreateConnectAccountDto,
  ) {
    const userId = req.user.id;
    const email = req.user.email;

    const account = await this.paymentsService.createConnectAccount(
      userId,
      email,
      dto.country,
      dto.businessType,
    );

    const accountLink = await this.paymentsService.createConnectAccountLink(
      account.id,
      dto.refreshUrl,
      dto.returnUrl,
    );

    return {
      success: true,
      data: {
        accountId: account.id,
        onboardingUrl: accountLink.url,
      },
    };
  }

  /**
   * Get onboarding link for existing Connect account
   * POST /payments/connect/onboarding-link
   */
  @Post('connect/onboarding-link')
  @UseGuards(JwtAuthGuard)
  async getConnectOnboardingLink(
    @Req() req: any,
    @Body() body: { returnUrl: string; refreshUrl: string },
  ) {
    const user = await this.userRepository.findOne({ where: { id: req.user.id } });
    if (!user?.stripeConnectAccountId) {
      throw new NotFoundException('No Connect account found. Create one first.');
    }

    const accountLink = await this.paymentsService.createConnectAccountLink(
      user.stripeConnectAccountId,
      body.refreshUrl,
      body.returnUrl,
    );

    return {
      success: true,
      data: {
        url: accountLink.url,
      },
    };
  }

  /**
   * Get Connect account status
   * GET /payments/connect/status
   */
  @Get('connect/status')
  @UseGuards(JwtAuthGuard)
  async getConnectStatus(@Req() req: any) {
    const user = await this.userRepository.findOne({ where: { id: req.user.id } });
    if (!user?.stripeConnectAccountId) {
      return { success: true, data: null };
    }

    try {
      const account = await this.paymentsService.getConnectAccount(user.stripeConnectAccountId);

      return {
        success: true,
        data: {
          accountId: account.id,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted,
          requirements: account.requirements,
        },
      };
    } catch {
      return {
        success: true,
        data: null,
      };
    }
  }

  // ============================================================================
  // Webhooks
  // ============================================================================

  /**
   * Handle Stripe webhooks
   * POST /payments/webhook
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET is not configured - rejecting webhook');
      return { received: false, error: 'Webhook secret not configured' };
    }

    const event = this.paymentsService.constructWebhookEvent(
      req.rawBody!,
      signature,
      webhookSecret,
    );

    // Handle specific events
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object);
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;

        case 'invoice.payment_succeeded':
          await this.handleInvoiceSucceeded(event.data.object);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoiceFailed(event.data.object);
          break;

        default:
          this.logger.debug(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`Webhook processing error for ${event.type}: ${error.message}`);
    }

    return { received: true };
  }

  private async handleCheckoutCompleted(session: any) {
    const userId = session.metadata?.userId;
    const bundleId = session.metadata?.bundleId;
    const sessionId = session.id;

    if (!userId) {
      this.logger.warn('Checkout session missing userId metadata');
      return;
    }

    // Idempotency check - prevent duplicate processing
    const idempotencyKey = `webhook:checkout:${sessionId}`;
    const alreadyProcessed = await this.cacheManager.get(idempotencyKey);
    if (alreadyProcessed) {
      this.logger.debug(`Checkout session ${sessionId} already processed, skipping`);
      return;
    }

    // Credit bundle purchase
    if (bundleId) {
      // Also check database for existing transaction with this reference
      const existingTx = await this.transactionRepository.findOne({
        where: {
          referenceId: session.payment_intent || sessionId,
          referenceType: 'stripe_payment',
        },
      });

      if (existingTx) {
        this.logger.debug(`Transaction already exists for payment ${session.payment_intent || sessionId}`);
        await this.cacheManager.set(idempotencyKey, true, WEBHOOK_IDEMPOTENCY_TTL_MS);
        return;
      }

      await this.creditsService.addCreditsFromPurchase(
        userId,
        bundleId,
        session.payment_intent || sessionId,
      );
      this.logger.log(`Credits added for user ${userId} from bundle ${bundleId}`);

      // Mark as processed
      await this.cacheManager.set(idempotencyKey, true, WEBHOOK_IDEMPOTENCY_TTL_MS);
      return;
    }

    // Subscription checkout - create local subscription record (upsert to avoid race condition)
    const planId = session.metadata?.planId;
    if (planId && session.subscription) {
      try {
        await this.subscriptionRepository
          .createQueryBuilder()
          .insert()
          .into('subscription')
          .values({
            userId,
            planId,
            stripeSubscriptionId: session.subscription,
            stripeCustomerId: session.customer,
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          })
          .orIgnore()
          .execute();
        this.logger.log(`Subscription created for user ${userId}`);
      } catch (err) {
        // Duplicate subscription already exists, safe to ignore
        this.logger.debug(`Subscription already exists for stripe ID ${session.subscription}`);
      }

      // Mark as processed
      await this.cacheManager.set(idempotencyKey, true, WEBHOOK_IDEMPOTENCY_TTL_MS);
    }
  }

  private async handleSubscriptionUpdated(subscription: any) {
    const sub = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (!sub) return;

    sub.status = subscription.status;
    sub.cancelAtPeriodEnd = subscription.cancel_at_period_end;
    sub.currentPeriodStart = new Date(subscription.current_period_start * 1000);
    sub.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    await this.subscriptionRepository.save(sub);
  }

  private async handleSubscriptionDeleted(subscription: any) {
    const sub = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (!sub) return;

    sub.status = 'canceled';
    sub.canceledAt = new Date();
    await this.subscriptionRepository.save(sub);
  }

  private async handleInvoiceSucceeded(invoice: any) {
    if (!invoice.subscription) return;

    const sub = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId: invoice.subscription },
      relations: ['plan'],
    });
    if (!sub) return;

    // Update period dates
    sub.currentPeriodStart = new Date(invoice.period_start * 1000);
    sub.currentPeriodEnd = new Date(invoice.period_end * 1000);
    sub.status = 'active';
    await this.subscriptionRepository.save(sub);

    this.logger.log(`Subscription renewed for user ${sub.userId}`);
  }

  private async handleInvoiceFailed(invoice: any) {
    if (!invoice.subscription) return;

    const sub = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId: invoice.subscription },
    });
    if (!sub) return;

    sub.status = 'past_due';
    await this.subscriptionRepository.save(sub);
    this.logger.warn(`Payment failed for subscription ${sub.id}, user ${sub.userId}`);
  }

  // ============================================================================
  // UPI Payments (India - Razorpay)
  // ============================================================================

  /**
   * Create UPI payment order for credit bundle purchase
   * POST /payments/upi/order
   */
  @Post('upi/order')
  @UseGuards(JwtAuthGuard)
  async createUPIOrder(
    @Req() req: any,
    @Body() dto: CreateUPIOrderDto,
  ) {
    const userId = req.user.id;

    const { order, razorpayKeyId } = await this.razorpayService.createOrder(
      userId,
      dto.bundleId,
    );

    return {
      success: true,
      data: {
        orderId: order.id,
        razorpayOrderId: order.razorpayOrderId,
        amountInPaise: order.amountInPaise,
        currency: order.currency,
        keyId: razorpayKeyId,
        receipt: order.receipt,
      },
    };
  }

  /**
   * Verify UPI payment after completion
   * POST /payments/upi/verify
   */
  @Post('upi/verify')
  @UseGuards(JwtAuthGuard)
  async verifyUPIPayment(
    @Req() req: any,
    @Body() dto: VerifyUPIPaymentDto,
  ) {
    const userId = req.user.id;

    const order = await this.razorpayService.verifyPayment(
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );

    // Add credits based on the bundle from the order
    if (order.referenceId) {
      await this.creditsService.addCreditsFromPurchase(
        userId,
        order.referenceId,
        dto.razorpayPaymentId,
      );
      this.logger.log(`UPI credits added for user ${userId}, bundle ${order.referenceId}`);
    }

    return {
      success: true,
      data: {
        orderId: order.id,
        status: order.status,
        method: order.method,
        vpa: order.vpa,
        paidAt: order.paidAt,
      },
    };
  }

  /**
   * Get Razorpay key ID for frontend integration
   * GET /payments/upi/config
   */
  @Get('upi/config')
  getUPIConfig() {
    return {
      success: true,
      data: {
        keyId: this.razorpayService.getKeyId(),
        currency: 'INR',
        name: 'Aardvark',
        description: 'Interactive Fiction Platform',
      },
    };
  }

  // ============================================================================
  // UPI Payouts (Author)
  // ============================================================================

  /**
   * Setup author's UPI payout account
   * POST /payments/upi/payout-account
   */
  @Post('upi/payout-account')
  @UseGuards(JwtAuthGuard)
  async setupUPIPayoutAccount(
    @Req() req: any,
    @Body() dto: SetupUPIPayoutAccountDto,
  ) {
    const authorId = req.user.id;

    const account = await this.razorpayService.setupAuthorUPIAccount(
      authorId,
      dto.upiVpa,
      dto.accountHolderName,
    );

    return {
      success: true,
      data: {
        id: account.id,
        upiVpa: account.upiVpa,
        accountHolderName: account.upiAccountHolderName,
        verified: account.upiVerified,
        payoutsEnabled: account.payoutsEnabled,
      },
    };
  }

  /**
   * Get author's UPI payout account status
   * GET /payments/upi/payout-account
   */
  @Get('upi/payout-account')
  @UseGuards(JwtAuthGuard)
  async getUPIPayoutAccount(@Req() req: any) {
    const account = await this.razorpayService.getAuthorPayoutAccount(req.user.id);
    return {
      success: true,
      data: account
        ? {
            id: account.id,
            upiVpa: account.upiVpa,
            accountHolderName: account.upiAccountHolderName,
            verified: account.upiVerified,
            payoutsEnabled: account.payoutsEnabled,
          }
        : null,
    };
  }

  /**
   * Request UPI payout
   * POST /payments/upi/payout
   */
  @Post('upi/payout')
  @UseGuards(JwtAuthGuard)
  async requestUPIPayout(
    @Req() req: any,
    @Body() dto: RequestUPIPayoutDto,
  ) {
    const authorId = req.user.id;
    if (!dto.amount) {
      throw new BadRequestException('Amount is required for UPI payout');
    }

    const payout = await this.razorpayService.createPayout(
      authorId,
      dto.amount,
      'Aardvark author earnings',
    );

    return {
      success: true,
      data: {
        id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        status: payout.status,
        upiVpa: payout.upiVpa,
        requestedAt: payout.requestedAt,
      },
    };
  }

  /**
   * Get payout history
   * GET /payments/upi/payouts
   */
  @Get('upi/payouts')
  @UseGuards(JwtAuthGuard)
  async getUPIPayoutHistory(@Req() req: any) {
    const payouts = await this.razorpayService.getPayoutHistory(req.user.id);
    return {
      success: true,
      data: payouts,
    };
  }

  // ============================================================================
  // Razorpay Webhooks
  // ============================================================================

  /**
   * Handle Razorpay webhooks
   * POST /payments/razorpay-webhook
   */
  @Post('razorpay-webhook')
  @HttpCode(HttpStatus.OK)
  async handleRazorpayWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const body = req.rawBody?.toString() || '';

    if (!this.razorpayService.verifyWebhookSignature(body, signature)) {
      return { received: false, error: 'Invalid signature' };
    }

    let payload: any;
    try {
      payload = JSON.parse(body);
    } catch {
      this.logger.warn('Invalid JSON in Razorpay webhook body');
      return { received: false, error: 'Invalid JSON payload' };
    }

    const event = payload.event;
    await this.razorpayService.handleWebhook(event, payload.payload);

    return { received: true };
  }
}
