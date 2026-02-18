import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AdsService } from "./ads.service";
import { AdReward, User, Transaction } from "@/database/entities";
import { TransactionType } from "@aardvark/shared";
import { AdType, AdProvider } from "./dto";

describe("AdsService", () => {
  let service: AdsService;
  let adRewardRepo: jest.Mocked<Repository<AdReward>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let transactionRepo: jest.Mocked<Repository<Transaction>>;
  let dataSource: jest.Mocked<DataSource>;

  // Transaction manager repos (used inside dataSource.transaction callback)
  let txManagerUserRepo: jest.Mocked<Partial<Repository<User>>>;
  let txManagerAdRewardRepo: jest.Mocked<Partial<Repository<AdReward>>>;
  let txManagerTxRepo: jest.Mocked<Partial<Repository<Transaction>>>;

  const mockUser = {
    id: "user-123",
    creditsBalance: 100,
  };

  const mockAdReward = {
    id: "ad-reward-123",
    userId: "user-123",
    adProvider: AdProvider.ADMOB,
    adType: AdType.REWARDED_VIDEO,
    creditsAwarded: 5,
    adUnitId: "ad-unit-1",
    sessionId: null,
    platform: "android",
    deviceId: null,
    ipAddress: "192.168.1.1",
    verificationToken: null,
    adMetadata: null,
    verified: false,
    watchedAt: new Date("2026-02-15"),
  };

  const mockRecordAdRewardDto = {
    adProvider: AdProvider.ADMOB,
    adType: AdType.REWARDED_VIDEO,
    adUnitId: "ad-unit-1",
    platform: "android",
  };

  beforeEach(async () => {
    // Create transaction manager repository mocks
    txManagerUserRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
    };

    txManagerAdRewardRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    txManagerTxRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockTransactionManager = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === User) return txManagerUserRepo;
        if (entity === AdReward) return txManagerAdRewardRepo;
        if (entity === Transaction) return txManagerTxRepo;
        return {};
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdsService,
        {
          provide: getRepositoryToken(AdReward),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getRawOne: jest.fn().mockResolvedValue({ total: "0" }),
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
          provide: getRepositoryToken(Transaction),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultVal: any) => {
                const config: Record<string, any> = {
                  AD_CREDITS_REWARDED_VIDEO: 5,
                  AD_CREDITS_INTERSTITIAL: 2,
                  DAILY_AD_LIMIT: 10,
                  AD_COOLDOWN_SECONDS: 30,
                  ADS_ENABLED: true,
                };
                return config[key] !== undefined ? config[key] : defaultVal;
              }),
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

    service = module.get<AdsService>(AdsService);
    adRewardRepo = module.get(getRepositoryToken(AdReward));
    userRepo = module.get(getRepositoryToken(User));
    transactionRepo = module.get(getRepositoryToken(Transaction));
    dataSource = module.get(DataSource);
  });

  // ===========================================================================
  // recordAdReward
  // ===========================================================================

  describe("recordAdReward", () => {
    /**
     * Helper to set up the common preconditions for a successful recordAdReward call:
     * - Daily limit not reached
     * - Cooldown elapsed
     * - User found in transaction
     */
    function setupSuccessfulRewardPreconditions() {
      // getDailyLimit: user has remaining ads
      adRewardRepo.count.mockResolvedValue(2);
      (adRewardRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: "10" }),
      });

      // No recent ad (cooldown check passes)
      adRewardRepo.findOne.mockResolvedValue(null);

      // Transaction manager: user found
      (txManagerUserRepo.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
      });
      (txManagerUserRepo.update as jest.Mock).mockResolvedValue(undefined);

      // Transaction manager: ad reward created and saved
      (txManagerAdRewardRepo.create as jest.Mock).mockReturnValue(mockAdReward);
      (txManagerAdRewardRepo.save as jest.Mock).mockResolvedValue(mockAdReward);

      // Transaction manager: transaction record created and saved
      (txManagerTxRepo.create as jest.Mock).mockReturnValue({
        id: "tx-123",
      });
      (txManagerTxRepo.save as jest.Mock).mockResolvedValue({ id: "tx-123" });
    }

    it("should use a database transaction for balance updates", async () => {
      setupSuccessfulRewardPreconditions();

      await service.recordAdReward(
        "user-123",
        mockRecordAdRewardDto as any,
        "192.168.1.1",
      );

      // Verify dataSource.transaction was called
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(dataSource.transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should update user balance atomically", async () => {
      setupSuccessfulRewardPreconditions();

      await service.recordAdReward(
        "user-123",
        mockRecordAdRewardDto as any,
        "192.168.1.1",
      );

      // Verify the user was looked up with a pessimistic write lock inside the transaction
      expect(txManagerUserRepo.findOne).toHaveBeenCalledWith({
        where: { id: "user-123" },
        lock: { mode: "pessimistic_write" },
      });

      // Verify user balance was updated with correct new balance
      // Original balance (100) + rewarded video credits (5) = 105
      expect(txManagerUserRepo.update).toHaveBeenCalledWith("user-123", {
        creditsBalance: 105,
      });
    });

    it("should create both an AdReward record and a Transaction record", async () => {
      setupSuccessfulRewardPreconditions();

      const result = await service.recordAdReward(
        "user-123",
        mockRecordAdRewardDto as any,
        "192.168.1.1",
      );

      // Verify AdReward record was created inside the transaction
      expect(txManagerAdRewardRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          adProvider: AdProvider.ADMOB,
          adType: AdType.REWARDED_VIDEO,
          creditsAwarded: 5,
          adUnitId: "ad-unit-1",
          platform: "android",
          ipAddress: "192.168.1.1",
        }),
      );
      expect(txManagerAdRewardRepo.save).toHaveBeenCalledWith(mockAdReward);

      // Verify Transaction record was created inside the transaction
      expect(txManagerTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          type: TransactionType.AD_REWARD,
          amount: 5,
          balance: 105,
          referenceId: mockAdReward.id,
          referenceType: "ad_reward",
        }),
      );
      expect(txManagerTxRepo.save).toHaveBeenCalledWith({ id: "tx-123" });

      // Verify the response
      expect(result.success).toBe(true);
      expect(result.creditsAwarded).toBe(5);
      expect(result.newBalance).toBe(105);
    });

    it("should throw if user not found within transaction", async () => {
      // getDailyLimit: user has remaining ads
      adRewardRepo.count.mockResolvedValue(0);
      (adRewardRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: "0" }),
      });

      // No recent ad (cooldown check passes)
      adRewardRepo.findOne.mockResolvedValue(null);

      // Transaction manager: user NOT found
      (txManagerUserRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.recordAdReward(
          "nonexistent-user",
          mockRecordAdRewardDto as any,
          "192.168.1.1",
        ),
      ).rejects.toThrow(BadRequestException);

      // Verify the transaction was still initiated
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);

      // Verify no balance update or record creation happened
      expect(txManagerUserRepo.update).not.toHaveBeenCalled();
      expect(txManagerAdRewardRepo.save).not.toHaveBeenCalled();
      expect(txManagerTxRepo.save).not.toHaveBeenCalled();
    });
  });
});
