import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { SubscriptionsService } from "./subscriptions.service";
import {
  Subscription,
  SubscriptionPlan,
  User,
  Transaction,
} from "@/database/entities";
import { PaymentsService } from "@/modules/payments/payments.service";
import { SubscriptionTier } from "@aardvark/shared";

describe("SubscriptionsService", () => {
  let service: SubscriptionsService;
  let subscriptionRepo: jest.Mocked<Repository<Subscription>>;
  let planRepo: jest.Mocked<Repository<SubscriptionPlan>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let transactionRepo: jest.Mocked<Repository<Transaction>>;
  let paymentsService: jest.Mocked<PaymentsService>;

  const mockPlan = {
    id: "plan-123",
    name: "Premium Monthly",
    tier: SubscriptionTier.PREMIUM,
    stripePriceId: "price_123",
    priceInCents: 999,
    interval: "month",
    features: ["ad-free", "unlimited-reading"],
    isActive: true,
  };

  const mockSubscription = {
    id: "sub-123",
    userId: "user-123",
    planId: "plan-123",
    plan: mockPlan,
    stripeSubscriptionId: "sub_stripe_123",
    stripeCustomerId: "cus_123",
    status: "active",
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
    canceledAt: null,
  };

  const mockStripeSubscription = {
    id: "sub_stripe_123",
    status: "active",
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    cancel_at_period_end: false,
    trial_start: null,
    trial_end: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SubscriptionPlan),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: PaymentsService,
          useValue: {
            getSubscription: jest.fn(),
            cancelSubscription: jest.fn(),
            resumeSubscription: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((cb) =>
              cb({
                getRepository: jest.fn().mockImplementation((entity) => {
                  if (entity === User) return userRepo;
                  if (entity === Transaction) return transactionRepo;
                  return {};
                }),
              }),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    subscriptionRepo = module.get(getRepositoryToken(Subscription));
    planRepo = module.get(getRepositoryToken(SubscriptionPlan));
    userRepo = module.get(getRepositoryToken(User));
    transactionRepo = module.get(getRepositoryToken(Transaction));
    paymentsService = module.get(PaymentsService);
  });

  describe("getPlans", () => {
    it("should return all active plans sorted by price", async () => {
      const plans = [
        mockPlan,
        {
          ...mockPlan,
          id: "plan-456",
          name: "Premium Yearly",
          priceInCents: 9999,
        },
      ];
      planRepo.find.mockResolvedValue(plans as any);

      const result = await service.getPlans();

      expect(result).toEqual(plans);
      expect(planRepo.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { priceInCents: "ASC" },
      });
    });

    it("should return empty array if no plans", async () => {
      planRepo.find.mockResolvedValue([]);

      const result = await service.getPlans();

      expect(result).toEqual([]);
    });
  });

  describe("getPlan", () => {
    it("should return plan by ID", async () => {
      planRepo.findOne.mockResolvedValue(mockPlan as any);

      const result = await service.getPlan("plan-123");

      expect(result).toEqual(mockPlan);
    });

    it("should throw NotFoundException if plan not found", async () => {
      planRepo.findOne.mockResolvedValue(null);

      await expect(service.getPlan("invalid-plan")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getSubscriptionStatus", () => {
    it("should return active subscription status with benefits", async () => {
      subscriptionRepo.findOne.mockResolvedValue(mockSubscription as any);

      const result = await service.getSubscriptionStatus("user-123");

      expect(result.isActive).toBe(true);
      expect(result.tier).toBe(SubscriptionTier.PREMIUM);
      expect(result.subscription).toEqual(mockSubscription);
      expect(result.plan).toEqual(mockPlan);
      expect(result.benefits).toBeDefined();
    });

    it("should return free tier status when no subscription", async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      const result = await service.getSubscriptionStatus("user-123");

      expect(result.isActive).toBe(false);
      expect(result.tier).toBe(SubscriptionTier.FREE);
      expect(result.subscription).toBeNull();
      expect(result.plan).toBeNull();
      expect(result.benefits).toBeNull();
    });

    it("should include renewal date when not canceling", async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        ...mockSubscription,
        cancelAtPeriodEnd: false,
      } as any);

      const result = await service.getSubscriptionStatus("user-123");

      expect(result.renewsAt).toBeDefined();
      expect(result.canceledAt).toBeNull();
    });

    it("should return null renewsAt when canceling at period end", async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        ...mockSubscription,
        cancelAtPeriodEnd: true,
      } as any);

      const result = await service.getSubscriptionStatus("user-123");

      expect(result.renewsAt).toBeNull();
    });
  });

  describe("isPremium", () => {
    it("should return true for premium subscription", async () => {
      subscriptionRepo.findOne.mockResolvedValue(mockSubscription as any);

      const result = await service.isPremium("user-123");

      expect(result).toBe(true);
    });

    it("should return false when no subscription", async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      const result = await service.isPremium("user-123");

      expect(result).toBe(false);
    });

    it("should return false for free tier plan", async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        ...mockSubscription,
        plan: { ...mockPlan, tier: SubscriptionTier.FREE },
      } as any);

      const result = await service.isPremium("user-123");

      expect(result).toBe(false);
    });
  });

  describe("createSubscription", () => {
    beforeEach(() => {
      planRepo.findOne.mockResolvedValue(mockPlan as any);
      paymentsService.getSubscription.mockResolvedValue(
        mockStripeSubscription as any,
      );
      subscriptionRepo.create.mockReturnValue(mockSubscription as any);
      subscriptionRepo.save.mockResolvedValue(mockSubscription as any);
      userRepo.update.mockResolvedValue({} as any);
      transactionRepo.create.mockReturnValue({} as any);
      transactionRepo.save.mockResolvedValue({} as any);
    });

    it("should create new subscription successfully", async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      const result = await service.createSubscription(
        "user-123",
        "plan-123",
        "sub_stripe_123",
        "cus_123",
      );

      expect(result).toEqual(mockSubscription);
      expect(subscriptionRepo.create).toHaveBeenCalled();
      expect(subscriptionRepo.save).toHaveBeenCalled();
    });

    it("should throw BadRequestException if user already has active subscription", async () => {
      subscriptionRepo.findOne.mockResolvedValue(mockSubscription as any);

      await expect(
        service.createSubscription(
          "user-123",
          "plan-123",
          "sub_stripe_123",
          "cus_123",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException if plan not found", async () => {
      planRepo.findOne.mockResolvedValue(null);
      subscriptionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createSubscription(
          "user-123",
          "invalid-plan",
          "sub_stripe_123",
          "cus_123",
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should fetch subscription details from Stripe", async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      await service.createSubscription(
        "user-123",
        "plan-123",
        "sub_stripe_123",
        "cus_123",
      );

      expect(paymentsService.getSubscription).toHaveBeenCalledWith(
        "sub_stripe_123",
      );
    });

    it("should update user subscription status", async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      await service.createSubscription(
        "user-123",
        "plan-123",
        "sub_stripe_123",
        "cus_123",
      );

      expect(userRepo.update).toHaveBeenCalledWith(
        "user-123",
        expect.objectContaining({
          subscriptionStatus: expect.any(String),
        }),
      );
    });
  });

  describe("cancelSubscription", () => {
    it("should throw NotFoundException if no active subscription", async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.cancelSubscription("user-123"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException for mobile subscriptions", async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        ...mockSubscription,
        stripeSubscriptionId: null,
        platform: "ios",
      } as any);

      await expect(
        service.cancelSubscription("user-123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should cancel subscription at period end by default", async () => {
      const canceledStripe = {
        ...mockStripeSubscription,
        status: "active",
        cancel_at_period_end: true,
      };
      subscriptionRepo.findOne.mockResolvedValue({ ...mockSubscription } as any);
      paymentsService.cancelSubscription.mockResolvedValue(canceledStripe as any);
      subscriptionRepo.save.mockImplementation((s) => Promise.resolve(s as any));

      const result = await service.cancelSubscription("user-123", false);

      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(result.canceledAt).toBeInstanceOf(Date);
      expect(paymentsService.cancelSubscription).toHaveBeenCalledWith(
        "sub_stripe_123",
        false,
      );
    });

    it("should cancel subscription immediately when requested", async () => {
      const canceledStripe = {
        ...mockStripeSubscription,
        status: "canceled",
        cancel_at_period_end: false,
      };
      subscriptionRepo.findOne.mockResolvedValue({ ...mockSubscription } as any);
      paymentsService.cancelSubscription.mockResolvedValue(canceledStripe as any);
      subscriptionRepo.save.mockImplementation((s) => Promise.resolve(s as any));

      await service.cancelSubscription("user-123", true);

      expect(paymentsService.cancelSubscription).toHaveBeenCalledWith(
        "sub_stripe_123",
        true,
      );
      expect(userRepo.update).toHaveBeenCalledWith(
        "user-123",
        expect.objectContaining({
          subscriptionStatus: expect.any(String),
        }),
      );
    });
  });

  describe("resumeSubscription", () => {
    it("should throw BadRequestException if no subscription to resume", async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.resumeSubscription("user-123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if subscription not active with cancelAtPeriodEnd", async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        ...mockSubscription,
        status: "active",
        cancelAtPeriodEnd: false, // not canceling
      } as any);

      await expect(
        service.resumeSubscription("user-123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException for mobile subscriptions", async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        ...mockSubscription,
        cancelAtPeriodEnd: true,
        stripeSubscriptionId: null,
        platform: "android",
      } as any);

      await expect(
        service.resumeSubscription("user-123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should resume a canceled subscription successfully", async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        ...mockSubscription,
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
      } as any);
      paymentsService.resumeSubscription.mockResolvedValue({} as any);
      subscriptionRepo.save.mockImplementation((s) => Promise.resolve(s as any));

      const result = await service.resumeSubscription("user-123");

      expect(result.cancelAtPeriodEnd).toBe(false);
      expect(result.canceledAt).toBeNull();
      expect(paymentsService.resumeSubscription).toHaveBeenCalledWith(
        "sub_stripe_123",
      );
    });
  });

  describe("handleRenewal", () => {
    it("should silently return if subscription not found", async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.handleRenewal("sub_nonexistent"),
      ).resolves.toBeUndefined();
    });

    it("should update subscription period from Stripe", async () => {
      const renewedStripe = {
        ...mockStripeSubscription,
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      };
      subscriptionRepo.findOne.mockResolvedValue({
        ...mockSubscription,
        plan: mockPlan,
      } as any);
      paymentsService.getSubscription.mockResolvedValue(renewedStripe as any);
      subscriptionRepo.save.mockImplementation((s) => Promise.resolve(s as any));
      userRepo.findOne.mockResolvedValue({ id: "user-123", creditsBalance: 100 } as any);
      transactionRepo.create.mockReturnValue({} as any);
      transactionRepo.save.mockResolvedValue({} as any);

      await service.handleRenewal("sub_stripe_123");

      expect(paymentsService.getSubscription).toHaveBeenCalledWith(
        "sub_stripe_123",
      );
      expect(subscriptionRepo.save).toHaveBeenCalled();
    });
  });

  describe("handleExpiration", () => {
    it("should silently return if subscription not found", async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.handleExpiration("sub_nonexistent"),
      ).resolves.toBeUndefined();
    });

    it("should mark subscription as canceled and downgrade user", async () => {
      subscriptionRepo.findOne.mockResolvedValue({ ...mockSubscription } as any);
      subscriptionRepo.save.mockImplementation((s) => Promise.resolve(s as any));

      await service.handleExpiration("sub_stripe_123");

      expect(subscriptionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: "canceled" }),
      );
      expect(userRepo.update).toHaveBeenCalledWith(
        "user-123",
        expect.objectContaining({
          subscriptionStatus: expect.any(String),
        }),
      );
    });
  });

  describe("getHistory", () => {
    it("should return subscription history sorted by date", async () => {
      const subs = [mockSubscription, { ...mockSubscription, id: "sub-456" }];
      subscriptionRepo.find.mockResolvedValue(subs as any);

      const result = await service.getHistory("user-123");

      expect(result).toEqual(subs);
      expect(subscriptionRepo.find).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        relations: ["plan"],
        order: { createdAt: "DESC" },
      });
    });
  });
});
