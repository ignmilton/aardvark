import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import {
  Subscription,
  SubscriptionPlan,
  User,
  Transaction,
} from "@/database/entities";
import {
  SubscriptionTier,
  SubscriptionStatus,
  PREMIUM_BENEFITS,
  PremiumBenefits,
  TransactionType,
} from "@aardvark/shared";
import { PaymentsService } from "@/modules/payments/payments.service";

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepository: Repository<SubscriptionPlan>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly paymentsService: PaymentsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get all active subscription plans
   */
  async getPlans(): Promise<SubscriptionPlan[]> {
    return this.planRepository.find({
      where: { isActive: true },
      order: { priceInCents: "ASC" },
    });
  }

  /**
   * Get a specific plan by ID
   */
  async getPlan(planId: string): Promise<SubscriptionPlan> {
    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException("Plan not found");
    }
    return plan;
  }

  /**
   * Get user's current subscription status
   */
  async getSubscriptionStatus(userId: string): Promise<{
    isActive: boolean;
    tier: SubscriptionTier;
    subscription: Subscription | null;
    plan: SubscriptionPlan | null;
    benefits: PremiumBenefits | null;
    renewsAt: Date | null;
    canceledAt: Date | null;
  }> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId, status: "active" },
      relations: ["plan"],
    });

    if (!subscription) {
      return {
        isActive: false,
        tier: SubscriptionTier.FREE,
        subscription: null,
        plan: null,
        benefits: null,
        renewsAt: null,
        canceledAt: null,
      };
    }

    return {
      isActive: true,
      tier: subscription.plan.tier,
      subscription,
      plan: subscription.plan,
      benefits:
        subscription.plan.tier === SubscriptionTier.PREMIUM
          ? PREMIUM_BENEFITS
          : null,
      renewsAt: subscription.cancelAtPeriodEnd
        ? null
        : subscription.currentPeriodEnd,
      canceledAt: subscription.canceledAt,
    };
  }

  /**
   * Check if user has premium subscription
   */
  async isPremium(userId: string): Promise<boolean> {
    const status = await this.getSubscriptionStatus(userId);
    return status.tier === SubscriptionTier.PREMIUM;
  }

  /**
   * Create a new subscription
   */
  async createSubscription(
    userId: string,
    planId: string,
    stripeSubscriptionId: string,
    stripeCustomerId: string,
  ): Promise<Subscription> {
    const plan = await this.getPlan(planId);

    // Check for existing active subscription
    const existing = await this.subscriptionRepository.findOne({
      where: { userId, status: "active" },
    });

    if (existing) {
      throw new BadRequestException("User already has an active subscription");
    }

    // Get subscription details from Stripe
    const stripeSubscription =
      await this.paymentsService.getSubscription(stripeSubscriptionId);

    const subscription = this.subscriptionRepository.create({
      userId,
      planId,
      stripeSubscriptionId,
      stripeCustomerId,
      status: stripeSubscription.status as any,
      currentPeriodStart: new Date(
        stripeSubscription.current_period_start * 1000,
      ),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      trialStart: stripeSubscription.trial_start
        ? new Date(stripeSubscription.trial_start * 1000)
        : null,
      trialEnd: stripeSubscription.trial_end
        ? new Date(stripeSubscription.trial_end * 1000)
        : null,
    });

    const saved = await this.subscriptionRepository.save(subscription);

    // Update user's subscription status
    await this.userRepository.update(userId, {
      subscriptionStatus: SubscriptionStatus.ACTIVE,
    });

    // Award monthly bonus credits for premium
    if (plan.tier === SubscriptionTier.PREMIUM) {
      await this.awardMonthlyCredits(userId);
    }

    return saved;
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    userId: string,
    cancelImmediately: boolean = false,
  ): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId, status: "active" },
    });

    if (!subscription) {
      throw new NotFoundException("No active subscription found");
    }

    if (!subscription.stripeSubscriptionId) {
      throw new BadRequestException(
        "Mobile subscriptions must be canceled through their respective app store.",
      );
    }
    // Cancel in Stripe
    const stripeSubscription = await this.paymentsService.cancelSubscription(
      subscription.stripeSubscriptionId,
      cancelImmediately,
    );

    // Update local record
    subscription.status = stripeSubscription.status as any;
    subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;
    subscription.canceledAt = new Date();

    const updated = await this.subscriptionRepository.save(subscription);

    // If immediate cancellation, update user status
    if (cancelImmediately) {
      await this.userRepository.update(userId, {
        subscriptionStatus: SubscriptionStatus.CANCELED,
      });
    }

    return updated;
  }

  /**
   * Resume a canceled subscription
   */
  async resumeSubscription(userId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId },
      order: { createdAt: "DESC" },
    });

    if (
      !subscription ||
      subscription.status !== "active" ||
      !subscription.cancelAtPeriodEnd
    ) {
      throw new BadRequestException("No subscription to resume");
    }

    if (!subscription.stripeSubscriptionId) {
      throw new BadRequestException(
        "Mobile subscriptions must be managed through their respective app store.",
      );
    }
    // Resume in Stripe
    await this.paymentsService.resumeSubscription(
      subscription.stripeSubscriptionId,
    );

    // Update local record
    subscription.cancelAtPeriodEnd = false;
    subscription.canceledAt = null;

    return this.subscriptionRepository.save(subscription);
  }

  /**
   * Handle subscription renewal (called from webhook)
   */
  async handleRenewal(stripeSubscriptionId: string): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId },
      relations: ["plan"],
    });

    if (!subscription) {
      return;
    }

    // Get updated info from Stripe
    const stripeSubscription =
      await this.paymentsService.getSubscription(stripeSubscriptionId);

    // Update local record
    subscription.status = stripeSubscription.status as any;
    subscription.currentPeriodStart = new Date(
      stripeSubscription.current_period_start * 1000,
    );
    subscription.currentPeriodEnd = new Date(
      stripeSubscription.current_period_end * 1000,
    );

    await this.subscriptionRepository.save(subscription);

    // Award monthly credits on renewal
    if (subscription.plan.tier === SubscriptionTier.PREMIUM) {
      await this.awardMonthlyCredits(subscription.userId);
    }
  }

  /**
   * Handle subscription expiration
   */
  async handleExpiration(stripeSubscriptionId: string): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId },
    });

    if (!subscription) {
      return;
    }

    subscription.status = "canceled";
    await this.subscriptionRepository.save(subscription);

    // Downgrade user subscription status
    await this.userRepository.update(subscription.userId, {
      subscriptionStatus: SubscriptionStatus.CANCELED,
    });
  }

  /**
   * Award monthly bonus credits for premium subscribers.
   * Uses pessimistic locking to prevent race conditions from concurrent webhooks.
   */
  private async awardMonthlyCredits(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const txRepo = manager.getRepository(Transaction);

      // Lock user row to prevent concurrent balance updates
      const user = await userRepo.findOne({
        where: { id: userId },
        lock: { mode: "pessimistic_write" },
      });
      if (!user) return;

      const newBalance =
        user.creditsBalance + PREMIUM_BENEFITS.monthlyBonusCredits;

      await userRepo.update(userId, { creditsBalance: newBalance });

      const transaction = txRepo.create({
        userId,
        type: TransactionType.SUBSCRIPTION_CREDIT,
        amount: PREMIUM_BENEFITS.monthlyBonusCredits,
        balance: newBalance,
        description: "Monthly Premium bonus credits",
      });

      await txRepo.save(transaction);
    });
  }

  /**
   * Get subscription history for a user
   */
  async getHistory(userId: string): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      where: { userId },
      relations: ["plan"],
      order: { createdAt: "DESC" },
    });
  }
}
