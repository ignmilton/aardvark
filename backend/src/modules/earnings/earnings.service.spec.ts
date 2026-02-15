import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EarningsService } from "./earnings.service";
import {
  AuthorEarning,
  AuthorPayoutAccount,
  Payout,
  User,
} from "@/database/entities";
import { PaymentsService } from "@/modules/payments/payments.service";

describe("EarningsService", () => {
  let service: EarningsService;
  let earningRepo: jest.Mocked<Repository<AuthorEarning>>;
  let accountRepo: jest.Mocked<Repository<AuthorPayoutAccount>>;
  let payoutRepo: jest.Mocked<Repository<Payout>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let paymentsService: jest.Mocked<PaymentsService>;
  let dataSource: jest.Mocked<DataSource>;

  const mockAuthor = {
    id: "author-123",
    email: "author@example.com",
    displayName: "Test Author",
  };

  const mockPayoutAccount = {
    id: "account-123",
    authorId: "author-123",
    stripeConnectAccountId: "acct_123",
    payoutsEnabled: true,
    chargesEnabled: true,
    accountStatus: "active",
    currency: "usd",
  };

  const mockEarnings = [
    {
      id: "e1",
      grossAmount: 100,
      platformFee: 30,
      netAmount: 70,
      type: "story_unlock",
    },
    { id: "e2", grossAmount: 50, platformFee: 5, netAmount: 45, type: "tip" },
  ];

  beforeEach(async () => {
    const mockTransactionManager = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === AuthorPayoutAccount) {
          return {
            findOne: jest.fn().mockResolvedValue(mockPayoutAccount),
          };
        }
        if (entity === Payout) {
          return {
            findOne: jest.fn().mockResolvedValue(null),
            create: jest
              .fn()
              .mockImplementation((data) => ({ id: "payout-new", ...data })),
            save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getRawOne: jest.fn().mockResolvedValue({ total: "0" }),
            }),
          };
        }
        if (entity === AuthorEarning) {
          return {
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getRawOne: jest.fn().mockResolvedValue({ total: "10000" }),
            }),
          };
        }
        return {};
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EarningsService,
        {
          provide: getRepositoryToken(AuthorEarning),
          useValue: {
            find: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              leftJoin: jest.fn().mockReturnThis(),
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              groupBy: jest.fn().mockReturnThis(),
              addGroupBy: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getManyAndCount: jest.fn().mockResolvedValue([mockEarnings, 2]),
              getRawMany: jest.fn().mockResolvedValue([]),
              getRawOne: jest.fn().mockResolvedValue({ total: "10000" }),
            }),
          },
        },
        {
          provide: getRepositoryToken(AuthorPayoutAccount),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Payout),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
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
          },
        },
        {
          provide: PaymentsService,
          useValue: {
            createConnectAccount: jest.fn(),
            createConnectAccountLink: jest.fn(),
            getConnectAccount: jest.fn(),
            createTransfer: jest.fn(),
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

    service = module.get<EarningsService>(EarningsService);
    earningRepo = module.get(getRepositoryToken(AuthorEarning));
    accountRepo = module.get(getRepositoryToken(AuthorPayoutAccount));
    payoutRepo = module.get(getRepositoryToken(Payout));
    userRepo = module.get(getRepositoryToken(User));
    paymentsService = module.get(PaymentsService);
    dataSource = module.get(DataSource);
  });

  describe("getSummary", () => {
    it("should return earnings summary", async () => {
      earningRepo.find.mockResolvedValue(mockEarnings as any);

      const result = await service.getSummary("author-123", "month");

      expect(result).toHaveProperty("totalGross");
      expect(result).toHaveProperty("totalFees");
      expect(result).toHaveProperty("totalNet");
      expect(result).toHaveProperty("pendingBalance");
      expect(result).toHaveProperty("lifetimePaidOut");
      expect(result).toHaveProperty("earningsByType");
    });

    it("should calculate totals correctly", async () => {
      earningRepo.find.mockResolvedValue(mockEarnings as any);

      const result = await service.getSummary("author-123", "all_time");

      expect(result.totalGross).toBe(150);
      expect(result.totalFees).toBe(35);
      expect(result.totalNet).toBe(115);
    });
  });

  describe("getPendingBalance", () => {
    it("should calculate pending balance correctly", async () => {
      const result = await service.getPendingBalance("author-123");

      // Total earned (10000) - Total paid out (0) = 10000
      expect(result).toBe(10000);
    });
  });

  describe("getEarnings", () => {
    it("should return paginated earnings", async () => {
      const result = await service.getEarnings("author-123", {
        page: 1,
        limit: 20,
      });

      expect(result).toHaveProperty("earnings");
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("page");
      expect(result).toHaveProperty("limit");
    });
  });

  describe("getPayoutAccount", () => {
    it("should return payout account if exists", async () => {
      accountRepo.findOne.mockResolvedValue(mockPayoutAccount as any);

      const result = await service.getPayoutAccount("author-123");

      expect(result).toEqual(mockPayoutAccount);
    });

    it("should return null if no account", async () => {
      accountRepo.findOne.mockResolvedValue(null);

      const result = await service.getPayoutAccount("author-123");

      expect(result).toBeNull();
    });
  });

  describe("setupPayoutAccount", () => {
    it("should throw NotFoundException if user not found", async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.setupPayoutAccount(
          "invalid-author",
          "US",
          "individual",
          "https://return.com",
          "https://refresh.com",
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should create new Stripe Connect account if none exists", async () => {
      userRepo.findOne.mockResolvedValue(mockAuthor as any);
      accountRepo.findOne.mockResolvedValue(null);
      paymentsService.createConnectAccount.mockResolvedValue({
        id: "acct_new",
      } as any);
      accountRepo.create.mockReturnValue({
        id: "account-new",
        stripeConnectAccountId: "acct_new",
      } as any);
      accountRepo.save.mockResolvedValue({
        id: "account-new",
        stripeConnectAccountId: "acct_new",
      } as any);
      paymentsService.createConnectAccountLink.mockResolvedValue({
        url: "https://onboarding.stripe.com",
      } as any);

      const result = await service.setupPayoutAccount(
        "author-123",
        "US",
        "individual",
        "https://return.com",
        "https://refresh.com",
      );

      expect(result).toHaveProperty("accountId");
      expect(result).toHaveProperty("onboardingUrl");
      expect(paymentsService.createConnectAccount).toHaveBeenCalled();
    });

    it("should use existing account if present", async () => {
      userRepo.findOne.mockResolvedValue(mockAuthor as any);
      accountRepo.findOne.mockResolvedValue(mockPayoutAccount as any);
      paymentsService.createConnectAccountLink.mockResolvedValue({
        url: "https://onboarding.stripe.com",
      } as any);

      const result = await service.setupPayoutAccount(
        "author-123",
        "US",
        "individual",
        "https://return.com",
        "https://refresh.com",
      );

      expect(result).toHaveProperty("onboardingUrl");
      expect(paymentsService.createConnectAccount).not.toHaveBeenCalled();
    });
  });

  describe("requestPayout", () => {
    it("should throw BadRequestException if account not set up", async () => {
      const mockManager = {
        getRepository: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue(null),
        }),
      };
      dataSource.transaction.mockImplementation((cb: any) => cb(mockManager));

      await expect(service.requestPayout("author-123")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException if payouts not enabled", async () => {
      const mockManager = {
        getRepository: jest.fn().mockReturnValue({
          findOne: jest
            .fn()
            .mockResolvedValue({ ...mockPayoutAccount, payoutsEnabled: false }),
        }),
      };
      dataSource.transaction.mockImplementation((cb: any) => cb(mockManager));

      await expect(service.requestPayout("author-123")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("processPayout", () => {
    it("should throw BadRequestException if payout not found", async () => {
      payoutRepo.findOne.mockResolvedValue(null);

      await expect(service.processPayout("invalid-payout")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException if payout not pending", async () => {
      payoutRepo.findOne.mockResolvedValue({
        id: "payout-123",
        status: "completed",
      } as any);

      await expect(service.processPayout("payout-123")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should process pending payout successfully", async () => {
      const pendingPayout = {
        id: "payout-123",
        authorId: "author-123",
        amount: 5000,
        status: "pending",
      };
      payoutRepo.findOne.mockResolvedValue(pendingPayout as any);
      accountRepo.findOne.mockResolvedValue(mockPayoutAccount as any);
      paymentsService.createTransfer.mockResolvedValue({ id: "tr_123" } as any);
      payoutRepo.save.mockImplementation((p) => Promise.resolve(p as any));

      const result = await service.processPayout("payout-123");

      expect(result.status).toBe("completed");
      expect(result.stripeTransferId).toBe("tr_123");
      expect(paymentsService.createTransfer).toHaveBeenCalledWith(
        5000,
        "acct_123",
        "Aardvark author payout",
        expect.any(Object),
      );
    });

    it("should mark payout as failed on error", async () => {
      const pendingPayout = {
        id: "payout-123",
        authorId: "author-123",
        amount: 5000,
        status: "pending",
      };
      payoutRepo.findOne.mockResolvedValue(pendingPayout as any);
      accountRepo.findOne.mockResolvedValue(mockPayoutAccount as any);
      paymentsService.createTransfer.mockRejectedValue(
        new Error("Transfer failed"),
      );
      payoutRepo.save.mockImplementation((p) => Promise.resolve(p as any));

      await expect(service.processPayout("payout-123")).rejects.toThrow(
        "Transfer failed",
      );
    });
  });

  describe("getEarningsByStory", () => {
    it("should return earnings grouped by story", async () => {
      (earningRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { storyId: "story-1", title: "First Story", amount: "5000" },
          { storyId: "story-2", title: "Second Story", amount: "3000" },
        ]),
      });

      const result = await service.getEarningsByStory("author-123", "month");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        storyId: "story-1",
        title: "First Story",
        amount: 5000,
      });
      expect(result[1]).toEqual({
        storyId: "story-2",
        title: "Second Story",
        amount: 3000,
      });
    });

    it("should handle null title as Unknown Story", async () => {
      (earningRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { storyId: "story-1", title: null, amount: "1000" },
        ]),
      });

      const result = await service.getEarningsByStory("author-123", "all_time");

      expect(result[0].title).toBe("Unknown Story");
    });
  });

  describe("updateAccountStatus", () => {
    it("should silently return if account not found", async () => {
      accountRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateAccountStatus("acct_nonexistent"),
      ).resolves.toBeUndefined();
    });

    it("should update account status from Stripe", async () => {
      accountRepo.findOne.mockResolvedValue(mockPayoutAccount as any);
      paymentsService.getConnectAccount.mockResolvedValue({
        charges_enabled: true,
        payouts_enabled: true,
        requirements: { disabled_reason: null, currently_due: [] },
      } as any);
      accountRepo.save.mockImplementation((a) => Promise.resolve(a as any));

      await service.updateAccountStatus("acct_123");

      expect(paymentsService.getConnectAccount).toHaveBeenCalledWith("acct_123");
      expect(accountRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          chargesEnabled: true,
          payoutsEnabled: true,
          accountStatus: "active",
        }),
      );
    });

    it("should set restricted status when requirements are due", async () => {
      accountRepo.findOne.mockResolvedValue(mockPayoutAccount as any);
      paymentsService.getConnectAccount.mockResolvedValue({
        charges_enabled: false,
        payouts_enabled: false,
        requirements: { disabled_reason: null, currently_due: ["id_document"] },
      } as any);
      accountRepo.save.mockImplementation((a) => Promise.resolve(a as any));

      await service.updateAccountStatus("acct_123");

      expect(accountRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          accountStatus: "restricted",
        }),
      );
    });
  });

  describe("requestPayout - additional paths", () => {
    it("should throw BadRequestException if pending payout already exists", async () => {
      const mockManager = {
        getRepository: jest.fn().mockImplementation((entity) => {
          if (entity === AuthorPayoutAccount) {
            return {
              findOne: jest.fn().mockResolvedValue(mockPayoutAccount),
            };
          }
          if (entity === Payout) {
            return {
              findOne: jest.fn().mockResolvedValue({ id: "payout-pending", status: "pending" }),
            };
          }
          return {};
        }),
      };
      dataSource.transaction.mockImplementation((cb: any) => cb(mockManager));

      await expect(service.requestPayout("author-123")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should create payout successfully with full balance", async () => {
      const mockManager = {
        getRepository: jest.fn().mockImplementation((entity) => {
          if (entity === AuthorPayoutAccount) {
            return {
              findOne: jest.fn().mockResolvedValue(mockPayoutAccount),
            };
          }
          if (entity === Payout) {
            return {
              findOne: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockImplementation((data) => ({ id: "payout-new", ...data })),
              save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
              createQueryBuilder: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({ total: "0" }),
              }),
            };
          }
          if (entity === AuthorEarning) {
            return {
              createQueryBuilder: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({ total: "50000" }),
              }),
            };
          }
          return {};
        }),
      };
      dataSource.transaction.mockImplementation((cb: any) => cb(mockManager));

      const result = await service.requestPayout("author-123");

      expect(result).toBeDefined();
      expect(result.amount).toBe(50000);
      expect(result.status).toBe("pending");
    });
  });

  describe("getPayoutHistory", () => {
    it("should return payout history sorted by date", async () => {
      const payouts = [
        { id: "p1", requestedAt: new Date() },
        { id: "p2", requestedAt: new Date() },
      ];
      payoutRepo.find.mockResolvedValue(payouts as any);

      const result = await service.getPayoutHistory("author-123");

      expect(result).toEqual(payouts);
      expect(payoutRepo.find).toHaveBeenCalledWith({
        where: { authorId: "author-123" },
        order: { requestedAt: "DESC" },
      });
    });
  });
});
