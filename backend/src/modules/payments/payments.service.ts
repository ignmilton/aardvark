import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";

/**
 * Payment service handling all Stripe operations.
 * Manages payment intents, subscriptions, and webhook processing.
 */
@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly configService: ConfigService) {
    const stripeKey = this.configService.get<string>("STRIPE_SECRET_KEY");
    const isDevelopment =
      this.configService.get<string>("NODE_ENV") !== "production";
    if (!stripeKey || stripeKey.includes("your_stripe")) {
      if (isDevelopment) {
        this.logger.warn(
          "Stripe not configured - payment features disabled in development",
        );
        this.stripe = null as unknown as Stripe;
        return;
      }
      throw new Error(
        "Stripe secret key not configured. Set STRIPE_SECRET_KEY environment variable.",
      );
    }
    this.stripe = new Stripe(stripeKey, {
      // TODO: Upgrade stripe SDK to latest and update apiVersion accordingly
      apiVersion: "2023-10-16",
    });
  }

  /**
   * Create or retrieve a Stripe customer for a user
   */
  async getOrCreateCustomer(
    userId: string,
    email: string,
    name?: string,
  ): Promise<Stripe.Customer> {
    // Try to find existing customer by metadata
    const existingCustomers = await this.stripe.customers.list({
      email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0];
    }

    // Create new customer
    return this.stripe.customers.create({
      email,
      name,
      metadata: {
        userId,
      },
    });
  }

  /**
   * Create a payment intent for one-time purchases (credit bundles)
   */
  async createPaymentIntent(
    customerId: string,
    amountInCents: number,
    currency: string = "usd",
    metadata: Record<string, string> = {},
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata,
    });
  }

  /**
   * Create a checkout session for credit bundle purchase
   */
  async createCreditCheckoutSession(
    customerId: string,
    priceId: string,
    userId: string,
    bundleId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        bundleId,
        type: "credit_purchase",
      },
    });
  }

  /**
   * Create a checkout session for subscription
   */
  async createSubscriptionCheckoutSession(
    customerId: string,
    priceId: string,
    userId: string,
    planId: string,
    successUrl: string,
    cancelUrl: string,
    trialPeriodDays?: number,
  ): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: trialPeriodDays
        ? { trial_period_days: trialPeriodDays }
        : undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        planId,
        type: "subscription",
      },
    });
  }

  /**
   * Create a subscription directly (with existing payment method)
   */
  async createSubscription(
    customerId: string,
    priceId: string,
    paymentMethodId?: string,
  ): Promise<Stripe.Subscription> {
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
    };

    if (paymentMethodId) {
      subscriptionParams.default_payment_method = paymentMethodId;
    }

    return this.stripe.subscriptions.create(subscriptionParams);
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelImmediately: boolean = false,
  ): Promise<Stripe.Subscription> {
    if (cancelImmediately) {
      return this.stripe.subscriptions.cancel(subscriptionId);
    }

    return this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  /**
   * Resume a canceled subscription (if still within period)
   */
  async resumeSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Create a setup intent for saving payment methods
   */
  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    return this.stripe.setupIntents.create({
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
    });
  }

  /**
   * List customer's payment methods
   */
  async listPaymentMethods(
    customerId: string,
    type: Stripe.PaymentMethodListParams.Type = "card",
  ): Promise<Stripe.PaymentMethod[]> {
    const methods = await this.stripe.paymentMethods.list({
      customer: customerId,
      type,
    });
    return methods.data;
  }

  /**
   * Detach a payment method from customer
   */
  async detachPaymentMethod(
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.detach(paymentMethodId);
  }

  // ============================================================================
  // Stripe Connect (for author payouts)
  // ============================================================================

  /**
   * Create a Stripe Connect account for an author
   */
  async createConnectAccount(
    authorId: string,
    email: string,
    country: string,
    businessType: "individual" | "company" = "individual",
  ): Promise<Stripe.Account> {
    return this.stripe.accounts.create({
      type: "express",
      country,
      email,
      business_type: businessType,
      capabilities: {
        transfers: { requested: true },
      },
      metadata: {
        authorId,
      },
    });
  }

  /**
   * Create an account link for Connect onboarding
   */
  async createConnectAccountLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
  ): Promise<Stripe.AccountLink> {
    return this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });
  }

  /**
   * Get Connect account details
   */
  async getConnectAccount(accountId: string): Promise<Stripe.Account> {
    return this.stripe.accounts.retrieve(accountId);
  }

  /**
   * Create a transfer to a connected account (payout to author)
   */
  async createTransfer(
    amountInCents: number,
    destinationAccountId: string,
    description: string,
    metadata: Record<string, string> = {},
    idempotencyKey?: string,
  ): Promise<Stripe.Transfer> {
    return this.stripe.transfers.create(
      {
        amount: amountInCents,
        currency: "usd",
        destination: destinationAccountId,
        description,
        metadata,
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );
  }

  // ============================================================================
  // Webhook Processing
  // ============================================================================

  /**
   * Construct and verify webhook event
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string,
  ): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (err) {
      this.logger.error(
        `Webhook signature verification failed: ${err.message}`,
      );
      throw new BadRequestException("Invalid webhook signature");
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhookEvent(
    event: Stripe.Event,
  ): Promise<{ handled: boolean; type: string }> {
    const eventType = event.type;
    this.logger.log(`Processing webhook event: ${eventType}`);

    // Return event type for upstream handlers to process
    return { handled: true, type: eventType };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Create a refund for a payment intent
   */
  async createRefund(
    paymentIntentId: string,
    amountInCents?: number,
    reason?: Stripe.RefundCreateParams.Reason,
  ): Promise<Stripe.Refund> {
    return this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amountInCents,
      reason,
    });
  }

  /**
   * Get balance (for platform balance checks)
   */
  async getBalance(): Promise<Stripe.Balance> {
    return this.stripe.balance.retrieve();
  }
}
