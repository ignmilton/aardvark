import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { Subscription, SubscriptionPlan, User } from '@/database/entities';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let subscriptionRepo: jest.Mocked<Repository<Subscription>>;
  let planRepo: jest.Mocked<Repository<SubscriptionPlan>>;
  let userRepo: jest.Mocked<Repository<User>>;

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    subscriptionStatus: 'free',
    isPremium: false,
  };

  const mockPlan = {
    id: 'plan-123',
    name: 'Premium Monthly',
    stripePriceId: 'price_123',
    priceInCents: 999,
    interval: 'month',
    features: ['ad-free', 'unlimited-reading'],
    isActive: true,
  };

  const mockSubscription = {
    id: 'sub-123',
    userId: 'user-123',
    planId: 'plan-123',
    stripeSubscriptionId: 'sub_stripe_123',
    stripeCustomerId: 'cus_123',
    status: 'active',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
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
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    subscriptionRepo = module.get(getRepositoryToken(Subscription));
    planRepo = module.get(getRepositoryToken(SubscriptionPlan));
    userRepo = module.get(getRepositoryToken(User));
  });

  describe('getPlans', () => {
    it('should return all active plans', async () => {
      const plans = [mockPlan, { ...mockPlan, id: 'plan-456', name: 'Premium Yearly' }];
      planRepo.find.mockResolvedValue(plans as any);

      const result = await service.getPlans();

      expect(result).toEqual(plans);
      expect(planRepo.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { priceInCents: 'ASC' },
      });
    });
  });

  describe('getUserSubscription', () => {
    it('should return user subscription with plan', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        ...mockSubscription,
        plan: mockPlan,
      } as any);

      const result = await service.getUserSubscription('user-123');

      expect(result).toBeDefined();
      expect(result?.plan).toEqual(mockPlan);
    });

    it('should return null if no subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      const result = await service.getUserSubscription('user-123');

      expect(result).toBeNull();
    });
  });

  describe('isUserPremium', () => {
    it('should return true for active subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        ...mockSubscription,
        status: 'active',
      } as any);

      const result = await service.isUserPremium('user-123');

      expect(result).toBe(true);
    });

    it('should return true for trialing subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        ...mockSubscription,
        status: 'trialing',
      } as any);

      const result = await service.isUserPremium('user-123');

      expect(result).toBe(true);
    });

    it('should return false for canceled subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        ...mockSubscription,
        status: 'canceled',
      } as any);

      const result = await service.isUserPremium('user-123');

      expect(result).toBe(false);
    });

    it('should return false if no subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      const result = await service.isUserPremium('user-123');

      expect(result).toBe(false);
    });
  });

  describe('createSubscription', () => {
    it('should create new subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);
      subscriptionRepo.create.mockReturnValue(mockSubscription as any);
      subscriptionRepo.save.mockResolvedValue(mockSubscription as any);

      const result = await service.createSubscription(
        'user-123',
        'plan-123',
        'sub_stripe_123',
        'cus_123',
      );

      expect(result).toEqual(mockSubscription);
      expect(subscriptionRepo.create).toHaveBeenCalled();
    });
  });

  describe('updateSubscriptionStatus', () => {
    it('should update subscription status', async () => {
      subscriptionRepo.findOne.mockResolvedValue(mockSubscription as any);
      subscriptionRepo.save.mockImplementation((s) => Promise.resolve(s as any));
      userRepo.update.mockResolvedValue({} as any);

      const result = await service.updateSubscriptionStatus('sub_stripe_123', 'canceled');

      expect(result.status).toBe('canceled');
    });

    it('should throw NotFoundException if subscription not found', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateSubscriptionStatus('invalid_sub', 'active'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update user premium status based on subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue(mockSubscription as any);
      subscriptionRepo.save.mockImplementation((s) => Promise.resolve(s as any));
      userRepo.update.mockResolvedValue({} as any);

      await service.updateSubscriptionStatus('sub_stripe_123', 'active');

      expect(userRepo.update).toHaveBeenCalledWith('user-123', {
        subscriptionStatus: 'active',
        isPremium: true,
      });
    });
  });

  describe('handleSubscriptionCanceled', () => {
    it('should mark subscription as canceled', async () => {
      subscriptionRepo.findOne.mockResolvedValue(mockSubscription as any);
      subscriptionRepo.save.mockImplementation((s) => Promise.resolve(s as any));
      userRepo.update.mockResolvedValue({} as any);

      const result = await service.handleSubscriptionCanceled('sub_stripe_123');

      expect(result.status).toBe('canceled');
      expect(result.canceledAt).toBeDefined();
    });
  });

  describe('handleSubscriptionRenewed', () => {
    it('should update period dates on renewal', async () => {
      subscriptionRepo.findOne.mockResolvedValue(mockSubscription as any);
      subscriptionRepo.save.mockImplementation((s) => Promise.resolve(s as any));

      const newStart = new Date();
      const newEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const result = await service.handleSubscriptionRenewed(
        'sub_stripe_123',
        newStart,
        newEnd,
      );

      expect(result.currentPeriodStart).toEqual(newStart);
      expect(result.currentPeriodEnd).toEqual(newEnd);
      expect(result.status).toBe('active');
    });
  });

  describe('getSubscriptionHistory', () => {
    it('should return subscription history for user', async () => {
      const history = [mockSubscription, { ...mockSubscription, id: 'sub-old' }];
      subscriptionRepo.find.mockResolvedValue(history as any);

      const result = await service.getSubscriptionHistory('user-123');

      expect(result).toEqual(history);
      expect(subscriptionRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        relations: ['plan'],
        order: { createdAt: 'DESC' },
      });
    });
  });
});
