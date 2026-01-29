import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { Transaction, User, Story, CreditBundle, AuthorEarning, StoryUnlock } from '@/database/entities';
import { TransactionType } from '@aardvark/shared';

describe('CreditsService', () => {
  let service: CreditsService;
  let transactionRepo: jest.Mocked<Repository<Transaction>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let storyRepo: jest.Mocked<Repository<Story>>;
  let bundleRepo: jest.Mocked<Repository<CreditBundle>>;
  let earningRepo: jest.Mocked<Repository<AuthorEarning>>;
  let storyUnlockRepo: jest.Mocked<Repository<StoryUnlock>>;
  let dataSource: jest.Mocked<DataSource>;

  const mockUser = {
    id: 'user-123',
    creditsBalance: 1000,
    isPremium: false,
  };

  const mockStory = {
    id: 'story-123',
    title: 'Test Story',
    authorId: 'author-123',
    isPremium: true,
    creditCost: 50,
    author: { id: 'author-123', displayName: 'Test Author' },
  };

  const mockBundle = {
    id: 'bundle-123',
    name: 'Starter Pack',
    credits: 100,
    bonusCredits: 10,
    priceInCents: 499,
    stripePriceId: 'price_123',
    isActive: true,
  };

  beforeEach(async () => {
    const mockTransactionManager = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === User) return userRepo;
        if (entity === Transaction) return transactionRepo;
        if (entity === AuthorEarning) return earningRepo;
        if (entity === StoryUnlock) return storyUnlockRepo;
        return {};
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getRawOne: jest.fn().mockResolvedValue({ total: '500' }),
            }),
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
          provide: getRepositoryToken(Story),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CreditBundle),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuthorEarning),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(StoryUnlock),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((cb) => cb(mockTransactionManager)),
          },
        },
      ],
    }).compile();

    service = module.get<CreditsService>(CreditsService);
    transactionRepo = module.get(getRepositoryToken(Transaction));
    userRepo = module.get(getRepositoryToken(User));
    storyRepo = module.get(getRepositoryToken(Story));
    bundleRepo = module.get(getRepositoryToken(CreditBundle));
    earningRepo = module.get(getRepositoryToken(AuthorEarning));
    storyUnlockRepo = module.get(getRepositoryToken(StoryUnlock));
    dataSource = module.get(DataSource);
  });

  describe('getBalance', () => {
    it('should return user balance and lifetime stats', async () => {
      userRepo.findOne.mockResolvedValue(mockUser as any);

      const result = await service.getBalance('user-123');

      expect(result.balance).toBe(1000);
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-123' } });
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.getBalance('invalid-user')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addCreditsFromPurchase', () => {
    it('should add credits from bundle purchase', async () => {
      bundleRepo.findOne.mockResolvedValue(mockBundle as any);
      userRepo.findOne.mockResolvedValue(mockUser as any);
      transactionRepo.create.mockReturnValue({ id: 'tx-123' } as any);
      transactionRepo.save.mockResolvedValue({ id: 'tx-123' } as any);

      const result = await service.addCreditsFromPurchase('user-123', 'bundle-123', 'pi_123');

      expect(bundleRepo.findOne).toHaveBeenCalledWith({ where: { id: 'bundle-123' } });
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if bundle not found', async () => {
      bundleRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addCreditsFromPurchase('user-123', 'invalid-bundle', 'pi_123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('unlockStory', () => {
    it('should throw NotFoundException if story not found', async () => {
      storyRepo.findOne.mockResolvedValue(null);

      await expect(service.unlockStory('user-123', { storyId: 'invalid' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if story is not premium', async () => {
      storyRepo.findOne.mockResolvedValue({ ...mockStory, isPremium: false } as any);

      await expect(service.unlockStory('user-123', { storyId: 'story-123' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if user tries to unlock own story', async () => {
      storyRepo.findOne.mockResolvedValue({ ...mockStory, authorId: 'user-123' } as any);

      await expect(service.unlockStory('user-123', { storyId: 'story-123' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if story already unlocked', async () => {
      storyRepo.findOne.mockResolvedValue(mockStory as any);
      storyUnlockRepo.findOne.mockResolvedValue({ id: 'unlock-123' } as any);

      await expect(service.unlockStory('user-123', { storyId: 'story-123' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('tipAuthor', () => {
    it('should throw BadRequestException if user tries to tip themselves', async () => {
      await expect(
        service.tipAuthor('user-123', { authorId: 'user-123', amount: 50 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if author not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.tipAuthor('user-123', { authorId: 'invalid-author', amount: 50 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('claimDailyBonus', () => {
    it('should throw BadRequestException if already claimed today', async () => {
      const today = new Date();
      transactionRepo.findOne.mockResolvedValue({
        id: 'tx-123',
        createdAt: today,
        type: TransactionType.DAILY_BONUS,
      } as any);

      await expect(service.claimDailyBonus('user-123')).rejects.toThrow(BadRequestException);
    });

    it('should allow claiming if last claim was yesterday', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      transactionRepo.findOne.mockResolvedValue({
        id: 'tx-123',
        createdAt: yesterday,
        type: TransactionType.DAILY_BONUS,
      } as any);
      userRepo.findOne.mockResolvedValue(mockUser as any);
      transactionRepo.create.mockReturnValue({ id: 'tx-new' } as any);
      transactionRepo.save.mockResolvedValue({ id: 'tx-new' } as any);

      const result = await service.claimDailyBonus('user-123');

      expect(result).toBeDefined();
    });
  });

  describe('rewardAdWatch', () => {
    it('should return null if ad not completed', async () => {
      const result = await service.rewardAdWatch('user-123', {
        completed: false,
        adUnitId: 'ad-123',
        adType: 'rewarded',
      });

      expect(result).toBeNull();
    });

    it('should throw ForbiddenException for premium users', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser, isPremium: true } as any);

      await expect(
        service.rewardAdWatch('user-123', {
          completed: true,
          adUnitId: 'ad-123',
          adType: 'rewarded',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if cooldown not elapsed', async () => {
      userRepo.findOne.mockResolvedValue(mockUser as any);
      transactionRepo.findOne.mockResolvedValue({
        id: 'tx-123',
        createdAt: new Date(), // Just now
        type: TransactionType.AD_WATCH,
      } as any);

      await expect(
        service.rewardAdWatch('user-123', {
          completed: true,
          adUnitId: 'ad-123',
          adType: 'rewarded',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('rewardStoryCompletion', () => {
    it('should throw BadRequestException if already rewarded', async () => {
      transactionRepo.findOne.mockResolvedValue({ id: 'tx-123' } as any);

      await expect(service.rewardStoryCompletion('user-123', 'story-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if story not found', async () => {
      transactionRepo.findOne.mockResolvedValue(null);
      storyRepo.findOne.mockResolvedValue(null);

      await expect(service.rewardStoryCompletion('user-123', 'invalid-story')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('isStoryUnlocked', () => {
    it('should return true if story is unlocked', async () => {
      storyUnlockRepo.findOne.mockResolvedValue({ id: 'unlock-123' } as any);

      const result = await service.isStoryUnlocked('user-123', 'story-123');

      expect(result).toBe(true);
    });

    it('should return false if story is not unlocked', async () => {
      storyUnlockRepo.findOne.mockResolvedValue(null);

      const result = await service.isStoryUnlocked('user-123', 'story-123');

      expect(result).toBe(false);
    });
  });

  describe('getUnlockedStoryIds', () => {
    it('should return array of unlocked story IDs', async () => {
      storyUnlockRepo.find.mockResolvedValue([
        { storyId: 'story-1' },
        { storyId: 'story-2' },
      ] as any);

      const result = await service.getUnlockedStoryIds('user-123');

      expect(result).toEqual(['story-1', 'story-2']);
    });
  });

  describe('getBundles', () => {
    it('should return active bundles sorted by price', async () => {
      const bundles = [mockBundle, { ...mockBundle, id: 'bundle-2', priceInCents: 999 }];
      bundleRepo.find.mockResolvedValue(bundles as any);

      const result = await service.getBundles();

      expect(result).toEqual(bundles);
      expect(bundleRepo.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { priceInCents: 'ASC' },
      });
    });
  });

  describe('getTodayAdWatchCount', () => {
    it('should return count of ad watches today', async () => {
      transactionRepo.count.mockResolvedValue(3);

      const result = await service.getTodayAdWatchCount('user-123');

      expect(result).toBe(3);
    });
  });
});
