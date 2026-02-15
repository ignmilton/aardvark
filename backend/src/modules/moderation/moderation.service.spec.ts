import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ModerationService } from "./moderation.service";
import {
  Report,
  ModerationLog,
  UserWarning,
  UserBan,
  ContentFlag,
  User,
  BanAppeal,
  UserMute,
  ModerationStatus,
  ModerationAction,
  ModerationContentType,
  ReportReason,
} from "@/database/entities";
import { AppealStatus } from "@/database/entities/ban-appeal.entity";
import { MuteScope } from "@/database/entities/user-mute.entity";
import { AccountStatus } from "@aardvark/shared";

describe("ModerationService", () => {
  let service: ModerationService;
  let reportRepo: jest.Mocked<Repository<Report>>;
  let moderationLogRepo: jest.Mocked<Repository<ModerationLog>>;
  let userWarningRepo: jest.Mocked<Repository<UserWarning>>;
  let userBanRepo: jest.Mocked<Repository<UserBan>>;
  let contentFlagRepo: jest.Mocked<Repository<ContentFlag>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let banAppealRepo: jest.Mocked<Repository<BanAppeal>>;
  let userMuteRepo: jest.Mocked<Repository<UserMute>>;

  const mockUser = {
    id: "user-123",
    username: "testuser",
    canModerate: false,
    accountStatus: AccountStatus.ACTIVE,
  };

  const mockModerator = {
    id: "mod-123",
    username: "moderator",
    canModerate: true,
  };

  const mockReport = {
    id: "report-123",
    reporterId: "user-456",
    contentType: ModerationContentType.STORY,
    contentId: "story-123",
    contentAuthorId: "author-789",
    reason: ReportReason.INAPPROPRIATE_CONTENT,
    status: ModerationStatus.PENDING,
    actionTaken: ModerationAction.NONE,
    createdAt: new Date(),
  };

  const mockBan = {
    id: "ban-123",
    userId: "user-123",
    issuedById: "mod-123",
    reason: ReportReason.HARASSMENT,
    details: "Repeated harassment",
    isPermanent: false,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    isActive: true,
    isShadowban: false,
  };

  const mockWarning = {
    id: "warning-123",
    userId: "user-123",
    issuedById: "mod-123",
    reason: ReportReason.INAPPROPRIATE_CONTENT,
    message: "Your content violated our guidelines",
    acknowledged: false,
  };

  const mockMute = {
    id: "mute-123",
    userId: "user-123",
    issuedById: "mod-123",
    scope: MuteScope.COMMENTS,
    reason: ReportReason.SPAM,
    details: "Spamming comments",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    isActive: true,
  };

  const mockAppeal = {
    id: "appeal-123",
    userId: "user-123",
    banId: "ban-123",
    reason: "I have reformed",
    status: AppealStatus.PENDING,
    ban: mockBan,
  };

  const mockContentFlag = {
    id: "flag-123",
    contentType: ModerationContentType.STORY,
    contentId: "story-123",
    authorId: "author-789",
    flagType: "profanity",
    confidence: 0.95,
    status: ModerationStatus.PENDING,
    isAutoResolved: false,
  };

  // Helper to create mock createQueryBuilder
  const createMockQueryBuilder = (result: any) => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(result),
    getRawMany: jest.fn().mockResolvedValue(result),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        {
          provide: getRepositoryToken(Report),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(
              createMockQueryBuilder([]),
            ),
          },
        },
        {
          provide: getRepositoryToken(ModerationLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findAndCount: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(
              createMockQueryBuilder([]),
            ),
          },
        },
        {
          provide: getRepositoryToken(UserWarning),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(
              createMockQueryBuilder(0),
            ),
          },
        },
        {
          provide: getRepositoryToken(UserBan),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ContentFlag),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            count: jest.fn(),
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
          provide: getRepositoryToken(BanAppeal),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findAndCount: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserMute),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ModerationService>(ModerationService);
    reportRepo = module.get(getRepositoryToken(Report));
    moderationLogRepo = module.get(getRepositoryToken(ModerationLog));
    userWarningRepo = module.get(getRepositoryToken(UserWarning));
    userBanRepo = module.get(getRepositoryToken(UserBan));
    contentFlagRepo = module.get(getRepositoryToken(ContentFlag));
    userRepo = module.get(getRepositoryToken(User));
    banAppealRepo = module.get(getRepositoryToken(BanAppeal));
    userMuteRepo = module.get(getRepositoryToken(UserMute));
  });

  // ============================================================
  // REPORTS
  // ============================================================

  describe("createReport", () => {
    it("should create a new report", async () => {
      reportRepo.findOne.mockResolvedValue(null);
      reportRepo.create.mockReturnValue(mockReport as any);
      reportRepo.save.mockResolvedValue(mockReport as any);

      const result = await service.createReport(
        "user-456",
        ModerationContentType.STORY,
        "story-123",
        ReportReason.INAPPROPRIATE_CONTENT,
        "This content is inappropriate",
      );

      expect(result).toEqual(mockReport);
      expect(reportRepo.create).toHaveBeenCalledWith({
        reporterId: "user-456",
        contentType: ModerationContentType.STORY,
        contentId: "story-123",
        reason: ReportReason.INAPPROPRIATE_CONTENT,
        details: "This content is inappropriate",
        status: ModerationStatus.PENDING,
        actionTaken: ModerationAction.NONE,
      });
    });

    it("should pass null details when not provided", async () => {
      reportRepo.findOne.mockResolvedValue(null);
      reportRepo.create.mockReturnValue(mockReport as any);
      reportRepo.save.mockResolvedValue(mockReport as any);

      await service.createReport(
        "user-456",
        ModerationContentType.STORY,
        "story-123",
        ReportReason.INAPPROPRIATE_CONTENT,
      );

      expect(reportRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ details: null }),
      );
    });

    it("should throw BadRequestException if already reported", async () => {
      reportRepo.findOne.mockResolvedValue(mockReport as any);

      await expect(
        service.createReport(
          "user-456",
          ModerationContentType.STORY,
          "story-123",
          ReportReason.INAPPROPRIATE_CONTENT,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getReportQueue", () => {
    it("should return paginated reports", async () => {
      const reports = [mockReport];
      reportRepo.findAndCount.mockResolvedValue([reports as any, 1]);

      const result = await service.getReportQueue({ page: 1, limit: 20 });

      expect(result).toHaveProperty("reports");
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("page");
      expect(result).toHaveProperty("limit");
      expect(result).toHaveProperty("totalPages");
      expect(result.reports).toEqual(reports);
    });

    it("should filter by contentType", async () => {
      reportRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getReportQueue({
        page: 1,
        limit: 20,
        contentType: ModerationContentType.COMMENT,
      });

      expect(reportRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contentType: ModerationContentType.COMMENT,
          }),
        }),
      );
    });

    it("should filter by status", async () => {
      reportRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getReportQueue({
        page: 1,
        limit: 20,
        status: ModerationStatus.PENDING,
      });

      expect(reportRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ModerationStatus.PENDING,
          }),
        }),
      );
    });

    it("should cap limit to 50", async () => {
      reportRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getReportQueue({ page: 1, limit: 100 });

      expect(reportRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        }),
      );
    });
  });

  describe("assignReport", () => {
    it("should assign report to moderator", async () => {
      reportRepo.findOne.mockResolvedValue({
        ...mockReport,
        status: ModerationStatus.PENDING,
      } as any);
      userRepo.findOne.mockResolvedValue(mockModerator as any);
      reportRepo.save.mockImplementation((r) => Promise.resolve(r as any));

      const result = await service.assignReport("report-123", "mod-123");

      expect(result.assignedModeratorId).toBe("mod-123");
      expect(result.status).toBe(ModerationStatus.UNDER_REVIEW);
    });

    it("should throw NotFoundException if report not found", async () => {
      reportRepo.findOne.mockResolvedValue(null);

      await expect(
        service.assignReport("invalid-report", "mod-123"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if report already resolved", async () => {
      reportRepo.findOne.mockResolvedValue({
        ...mockReport,
        status: ModerationStatus.RESOLVED,
      } as any);

      await expect(
        service.assignReport("report-123", "mod-123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if moderator is invalid", async () => {
      reportRepo.findOne.mockResolvedValue(mockReport as any);
      userRepo.findOne.mockResolvedValue({
        ...mockUser,
        canModerate: false,
      } as any);

      await expect(
        service.assignReport("report-123", "user-123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if moderator not found", async () => {
      reportRepo.findOne.mockResolvedValue(mockReport as any);
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.assignReport("report-123", "nonexistent"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("resolveReport", () => {
    it("should resolve report with action", async () => {
      reportRepo.findOne.mockResolvedValue({
        ...mockReport,
        status: ModerationStatus.UNDER_REVIEW,
      } as any);
      reportRepo.save.mockImplementation((r) => Promise.resolve(r as any));
      moderationLogRepo.create.mockReturnValue({} as any);
      moderationLogRepo.save.mockResolvedValue({} as any);

      const result = await service.resolveReport(
        "report-123",
        "mod-123",
        ModerationAction.CONTENT_REMOVED,
        "Content violated guidelines",
      );

      expect(result.actionTaken).toBe(ModerationAction.CONTENT_REMOVED);
      expect(result.status).toBe(ModerationStatus.RESOLVED);
      expect(result.moderatorNotes).toBe("Content violated guidelines");
    });

    it("should set resolvedAt timestamp", async () => {
      reportRepo.findOne.mockResolvedValue({
        ...mockReport,
        status: ModerationStatus.UNDER_REVIEW,
      } as any);
      reportRepo.save.mockImplementation((r) => Promise.resolve(r as any));
      moderationLogRepo.create.mockReturnValue({} as any);
      moderationLogRepo.save.mockResolvedValue({} as any);

      const result = await service.resolveReport(
        "report-123",
        "mod-123",
        ModerationAction.DISMISSED,
      );

      expect(result.resolvedAt).toBeInstanceOf(Date);
    });

    it("should create moderation log entry", async () => {
      reportRepo.findOne.mockResolvedValue({
        ...mockReport,
        status: ModerationStatus.UNDER_REVIEW,
      } as any);
      reportRepo.save.mockImplementation((r) => Promise.resolve(r as any));
      moderationLogRepo.create.mockReturnValue({} as any);
      moderationLogRepo.save.mockResolvedValue({} as any);

      await service.resolveReport(
        "report-123",
        "mod-123",
        ModerationAction.CONTENT_REMOVED,
        "Content violated guidelines",
      );

      expect(moderationLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          moderatorId: "mod-123",
          action: ModerationAction.CONTENT_REMOVED,
        }),
      );
      expect(moderationLogRepo.save).toHaveBeenCalled();
    });

    it("should throw NotFoundException if report not found", async () => {
      reportRepo.findOne.mockResolvedValue(null);

      await expect(
        service.resolveReport(
          "invalid-report",
          "mod-123",
          ModerationAction.DISMISSED,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if already resolved", async () => {
      reportRepo.findOne.mockResolvedValue({
        ...mockReport,
        status: ModerationStatus.RESOLVED,
      } as any);

      await expect(
        service.resolveReport(
          "report-123",
          "mod-123",
          ModerationAction.DISMISSED,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================================
  // WARNINGS
  // ============================================================

  describe("issueWarning", () => {
    it("should issue a warning to a user", async () => {
      userRepo.findOne.mockResolvedValue(mockUser as any);
      userWarningRepo.create.mockReturnValue(mockWarning as any);
      userWarningRepo.save.mockResolvedValue(mockWarning as any);
      moderationLogRepo.create.mockReturnValue({} as any);
      moderationLogRepo.save.mockResolvedValue({} as any);

      const result = await service.issueWarning(
        "user-123",
        "mod-123",
        ReportReason.INAPPROPRIATE_CONTENT,
        "Your content violated our guidelines",
      );

      expect(result).toEqual(mockWarning);
      expect(userWarningRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          issuedById: "mod-123",
          reason: ReportReason.INAPPROPRIATE_CONTENT,
          message: "Your content violated our guidelines",
          acknowledged: false,
        }),
      );
    });

    it("should create moderation log entry for warning", async () => {
      userRepo.findOne.mockResolvedValue(mockUser as any);
      userWarningRepo.create.mockReturnValue(mockWarning as any);
      userWarningRepo.save.mockResolvedValue(mockWarning as any);
      moderationLogRepo.create.mockReturnValue({} as any);
      moderationLogRepo.save.mockResolvedValue({} as any);

      await service.issueWarning(
        "user-123",
        "mod-123",
        ReportReason.INAPPROPRIATE_CONTENT,
        "Warning message",
      );

      expect(moderationLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          moderatorId: "mod-123",
          action: ModerationAction.USER_WARNED,
        }),
      );
    });

    it("should throw NotFoundException if user not found", async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.issueWarning(
          "nonexistent",
          "mod-123",
          ReportReason.HARASSMENT,
          "Warning",
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should include reportId when provided", async () => {
      userRepo.findOne.mockResolvedValue(mockUser as any);
      userWarningRepo.create.mockReturnValue(mockWarning as any);
      userWarningRepo.save.mockResolvedValue(mockWarning as any);
      moderationLogRepo.create.mockReturnValue({} as any);
      moderationLogRepo.save.mockResolvedValue({} as any);

      await service.issueWarning(
        "user-123",
        "mod-123",
        ReportReason.HARASSMENT,
        "Warning",
        "report-123",
      );

      expect(userWarningRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: "report-123",
        }),
      );
    });
  });

  describe("getUserWarnings", () => {
    it("should return warnings for a user sorted by date", async () => {
      const warnings = [mockWarning, { ...mockWarning, id: "warning-456" }];
      userWarningRepo.find.mockResolvedValue(warnings as any);

      const result = await service.getUserWarnings("user-123");

      expect(result).toEqual(warnings);
      expect(userWarningRepo.find).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        relations: ["issuedBy", "report"],
        order: { createdAt: "DESC" },
      });
    });
  });

  // ============================================================
  // BANS
  // ============================================================

  describe("issueBan", () => {
    beforeEach(() => {
      moderationLogRepo.create.mockReturnValue({} as any);
      moderationLogRepo.save.mockResolvedValue({} as any);
    });

    it("should issue a temporary ban", async () => {
      userRepo.findOne.mockResolvedValue(mockUser as any);
      userBanRepo.findOne.mockResolvedValue(null);
      userBanRepo.create.mockReturnValue(mockBan as any);
      userBanRepo.save.mockResolvedValue(mockBan as any);

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const result = await service.issueBan(
        "user-123",
        "mod-123",
        ReportReason.HARASSMENT,
        "Repeated harassment",
        false,
        expiresAt,
      );

      expect(result).toEqual(mockBan);
      expect(userRepo.update).toHaveBeenCalledWith("user-123", {
        accountStatus: AccountStatus.SUSPENDED,
      });
    });

    it("should issue a permanent ban", async () => {
      userRepo.findOne.mockResolvedValue(mockUser as any);
      userBanRepo.findOne.mockResolvedValue(null);
      const permBan = { ...mockBan, isPermanent: true, expiresAt: null };
      userBanRepo.create.mockReturnValue(permBan as any);
      userBanRepo.save.mockResolvedValue(permBan as any);

      await service.issueBan(
        "user-123",
        "mod-123",
        ReportReason.HATE_SPEECH,
        "Hate speech",
        true,
      );

      expect(userRepo.update).toHaveBeenCalledWith("user-123", {
        accountStatus: AccountStatus.BANNED,
      });
    });

    it("should issue a shadowban", async () => {
      userRepo.findOne.mockResolvedValue(mockUser as any);
      userBanRepo.findOne.mockResolvedValue(null);
      userBanRepo.create.mockReturnValue({ ...mockBan, isShadowban: true } as any);
      userBanRepo.save.mockResolvedValue({ ...mockBan, isShadowban: true } as any);

      await service.issueBan(
        "user-123",
        "mod-123",
        ReportReason.SPAM,
        "Spamming",
        false,
        new Date(Date.now() + 86400000),
        true,
      );

      expect(moderationLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: ModerationAction.USER_SHADOWBAN,
        }),
      );
    });

    it("should throw NotFoundException if user not found", async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.issueBan(
          "nonexistent",
          "mod-123",
          ReportReason.HARASSMENT,
          "Test",
          true,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if user already banned", async () => {
      userRepo.findOne.mockResolvedValue(mockUser as any);
      userBanRepo.findOne.mockResolvedValue(mockBan as any);

      await expect(
        service.issueBan(
          "user-123",
          "mod-123",
          ReportReason.HARASSMENT,
          "Test",
          true,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException for temporary ban without expiration", async () => {
      userRepo.findOne.mockResolvedValue(mockUser as any);
      userBanRepo.findOne.mockResolvedValue(null);

      await expect(
        service.issueBan(
          "user-123",
          "mod-123",
          ReportReason.HARASSMENT,
          "Test",
          false,
          undefined,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("liftBan", () => {
    it("should lift an active ban", async () => {
      userBanRepo.findOne.mockResolvedValue({
        ...mockBan,
        isActive: true,
        user: mockUser,
      } as any);
      userBanRepo.save.mockImplementation((b) => Promise.resolve(b as any));
      moderationLogRepo.create.mockReturnValue({} as any);
      moderationLogRepo.save.mockResolvedValue({} as any);

      const result = await service.liftBan("ban-123", "mod-123");

      expect(result.isActive).toBe(false);
      expect(result.liftedAt).toBeInstanceOf(Date);
      expect(result.liftedById).toBe("mod-123");
      expect(userRepo.update).toHaveBeenCalledWith("user-123", {
        accountStatus: AccountStatus.ACTIVE,
      });
    });

    it("should throw NotFoundException if ban not found", async () => {
      userBanRepo.findOne.mockResolvedValue(null);

      await expect(
        service.liftBan("nonexistent", "mod-123"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if ban already inactive", async () => {
      userBanRepo.findOne.mockResolvedValue({
        ...mockBan,
        isActive: false,
      } as any);

      await expect(
        service.liftBan("ban-123", "mod-123"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getUserBans", () => {
    it("should return bans for a user sorted by date", async () => {
      const bans = [mockBan];
      userBanRepo.find.mockResolvedValue(bans as any);

      const result = await service.getUserBans("user-123");

      expect(result).toEqual(bans);
      expect(userBanRepo.find).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        relations: ["issuedBy", "liftedBy"],
        order: { createdAt: "DESC" },
      });
    });
  });

  describe("isUserBanned", () => {
    it("should return true for actively banned user", async () => {
      userBanRepo.findOne.mockResolvedValue(mockBan as any);

      const result = await service.isUserBanned("user-123");

      expect(result.isBanned).toBe(true);
      expect(result.ban).toEqual(mockBan);
    });

    it("should return false for non-banned user", async () => {
      userBanRepo.findOne.mockResolvedValue(null);

      const result = await service.isUserBanned("user-123");

      expect(result.isBanned).toBe(false);
      expect(result.ban).toBeNull();
    });

    it("should auto-expire temporary bans that have passed", async () => {
      const expiredBan = {
        ...mockBan,
        isPermanent: false,
        expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
      };
      userBanRepo.findOne.mockResolvedValue(expiredBan as any);
      userBanRepo.save.mockImplementation((b) => Promise.resolve(b as any));

      const result = await service.isUserBanned("user-123");

      expect(result.isBanned).toBe(false);
      expect(result.ban).toBeNull();
      expect(userBanRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });
  });

  // ============================================================
  // CONTENT FLAGS
  // ============================================================

  describe("createContentFlag", () => {
    it("should create a content flag", async () => {
      contentFlagRepo.create.mockReturnValue(mockContentFlag as any);
      contentFlagRepo.save.mockResolvedValue(mockContentFlag as any);

      const result = await service.createContentFlag(
        ModerationContentType.STORY,
        "story-123",
        "author-789",
        "profanity",
        0.95,
        "matched: [word1, word2]",
      );

      expect(result).toEqual(mockContentFlag);
      expect(contentFlagRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          contentType: ModerationContentType.STORY,
          contentId: "story-123",
          authorId: "author-789",
          flagType: "profanity",
          confidence: 0.95,
          matchedPatterns: "matched: [word1, word2]",
          status: ModerationStatus.PENDING,
          isAutoResolved: false,
        }),
      );
    });

    it("should handle null patterns", async () => {
      contentFlagRepo.create.mockReturnValue(mockContentFlag as any);
      contentFlagRepo.save.mockResolvedValue(mockContentFlag as any);

      await service.createContentFlag(
        ModerationContentType.COMMENT,
        "comment-123",
        null,
        "toxicity",
        0.8,
      );

      expect(contentFlagRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          matchedPatterns: null,
        }),
      );
    });
  });

  describe("getContentFlags", () => {
    it("should return paginated content flags", async () => {
      const flags = [mockContentFlag];
      contentFlagRepo.findAndCount.mockResolvedValue([flags as any, 1]);

      const result = await service.getContentFlags({ page: 1, limit: 20 });

      expect(result.flags).toEqual(flags);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it("should filter by contentType", async () => {
      contentFlagRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getContentFlags({
        contentType: ModerationContentType.COMMENT,
      });

      expect(contentFlagRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contentType: ModerationContentType.COMMENT,
          }),
        }),
      );
    });

    it("should cap limit to 50", async () => {
      contentFlagRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getContentFlags({ page: 1, limit: 200 });

      expect(contentFlagRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });
  });

  describe("resolveContentFlag", () => {
    it("should resolve a content flag", async () => {
      contentFlagRepo.findOne.mockResolvedValue(mockContentFlag as any);
      contentFlagRepo.save.mockImplementation((f) => Promise.resolve(f as any));
      moderationLogRepo.create.mockReturnValue({} as any);
      moderationLogRepo.save.mockResolvedValue({} as any);

      const result = await service.resolveContentFlag(
        "flag-123",
        "mod-123",
        ModerationAction.CONTENT_REMOVED,
        "Profanity confirmed",
      );

      expect(result.status).toBe(ModerationStatus.RESOLVED);
      expect(moderationLogRepo.create).toHaveBeenCalled();
    });

    it("should throw NotFoundException if flag not found", async () => {
      contentFlagRepo.findOne.mockResolvedValue(null);

      await expect(
        service.resolveContentFlag(
          "nonexistent",
          "mod-123",
          ModerationAction.DISMISSED,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // MUTES
  // ============================================================

  describe("issueMute", () => {
    it("should issue a mute to a user", async () => {
      userRepo.findOne.mockResolvedValue(mockUser as any);
      userMuteRepo.findOne.mockResolvedValue(null);
      userMuteRepo.create.mockReturnValue(mockMute as any);
      userMuteRepo.save.mockResolvedValue(mockMute as any);
      moderationLogRepo.create.mockReturnValue({} as any);
      moderationLogRepo.save.mockResolvedValue({} as any);

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = await service.issueMute(
        "user-123",
        "mod-123",
        MuteScope.COMMENTS,
        ReportReason.SPAM,
        "Spamming comments",
        expiresAt,
      );

      expect(result).toEqual(mockMute);
      expect(userMuteRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          scope: MuteScope.COMMENTS,
          isActive: true,
        }),
      );
    });

    it("should throw NotFoundException if user not found", async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.issueMute(
          "nonexistent",
          "mod-123",
          MuteScope.COMMENTS,
          ReportReason.SPAM,
          "Spam",
          new Date(),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if user already has active mute of same scope", async () => {
      userRepo.findOne.mockResolvedValue(mockUser as any);
      userMuteRepo.findOne.mockResolvedValue(mockMute as any);

      await expect(
        service.issueMute(
          "user-123",
          "mod-123",
          MuteScope.COMMENTS,
          ReportReason.SPAM,
          "Spam",
          new Date(),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("liftMute", () => {
    it("should lift an active mute", async () => {
      userMuteRepo.findOne.mockResolvedValue({ ...mockMute, isActive: true } as any);
      userMuteRepo.save.mockImplementation((m) => Promise.resolve(m as any));
      moderationLogRepo.create.mockReturnValue({} as any);
      moderationLogRepo.save.mockResolvedValue({} as any);

      const result = await service.liftMute("mute-123", "mod-123");

      expect(result.isActive).toBe(false);
      expect(result.liftedAt).toBeInstanceOf(Date);
      expect(result.liftedById).toBe("mod-123");
    });

    it("should throw NotFoundException if mute not found", async () => {
      userMuteRepo.findOne.mockResolvedValue(null);

      await expect(
        service.liftMute("nonexistent", "mod-123"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if mute already inactive", async () => {
      userMuteRepo.findOne.mockResolvedValue({
        ...mockMute,
        isActive: false,
      } as any);

      await expect(
        service.liftMute("mute-123", "mod-123"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getUserMutes", () => {
    it("should return active mutes for a user", async () => {
      const mutes = [mockMute];
      userMuteRepo.find.mockResolvedValue(mutes as any);

      const result = await service.getUserMutes("user-123");

      expect(result).toEqual(mutes);
      expect(userMuteRepo.find).toHaveBeenCalledWith({
        where: { userId: "user-123", isActive: true },
        relations: ["issuedBy"],
        order: { createdAt: "DESC" },
      });
    });
  });

  describe("isUserMuted", () => {
    it("should return true for actively muted user", async () => {
      userMuteRepo.findOne.mockResolvedValue(mockMute as any);

      const result = await service.isUserMuted("user-123", MuteScope.COMMENTS);

      expect(result.isMuted).toBe(true);
      expect(result.mute).toEqual(mockMute);
    });

    it("should return false for non-muted user", async () => {
      userMuteRepo.findOne.mockResolvedValue(null);

      const result = await service.isUserMuted("user-123", MuteScope.COMMENTS);

      expect(result.isMuted).toBe(false);
      expect(result.mute).toBeNull();
    });

    it("should auto-expire mutes that have passed", async () => {
      const expiredMute = {
        ...mockMute,
        expiresAt: new Date(Date.now() - 1000),
      };
      userMuteRepo.findOne.mockResolvedValue(expiredMute as any);
      userMuteRepo.save.mockImplementation((m) => Promise.resolve(m as any));

      const result = await service.isUserMuted("user-123", MuteScope.COMMENTS);

      expect(result.isMuted).toBe(false);
      expect(result.mute).toBeNull();
      expect(userMuteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });
  });

  // ============================================================
  // APPEALS
  // ============================================================

  describe("createAppeal", () => {
    it("should create a ban appeal", async () => {
      userBanRepo.findOne.mockResolvedValue(mockBan as any);
      banAppealRepo.findOne.mockResolvedValue(null);
      banAppealRepo.create.mockReturnValue(mockAppeal as any);
      banAppealRepo.save.mockResolvedValue(mockAppeal as any);

      const result = await service.createAppeal(
        "user-123",
        "ban-123",
        "I have reformed",
      );

      expect(result).toEqual(mockAppeal);
      expect(banAppealRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          banId: "ban-123",
          reason: "I have reformed",
          status: AppealStatus.PENDING,
        }),
      );
    });

    it("should throw NotFoundException if ban not found", async () => {
      userBanRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createAppeal("user-123", "nonexistent", "reason"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if appeal already pending", async () => {
      userBanRepo.findOne.mockResolvedValue(mockBan as any);
      banAppealRepo.findOne.mockResolvedValue(mockAppeal as any);

      await expect(
        service.createAppeal("user-123", "ban-123", "reason"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getAppealsQueue", () => {
    it("should return paginated appeals", async () => {
      const appeals = [mockAppeal];
      banAppealRepo.findAndCount.mockResolvedValue([appeals as any, 1]);

      const result = await service.getAppealsQueue({ page: 1, limit: 20 });

      expect(result.appeals).toEqual(appeals);
      expect(result.total).toBe(1);
    });

    it("should filter by status", async () => {
      banAppealRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getAppealsQueue({ status: AppealStatus.PENDING });

      expect(banAppealRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: AppealStatus.PENDING,
          }),
        }),
      );
    });
  });

  describe("reviewAppeal", () => {
    it("should approve appeal and lift ban", async () => {
      banAppealRepo.findOne.mockResolvedValue({
        ...mockAppeal,
        status: AppealStatus.PENDING,
      } as any);
      banAppealRepo.save.mockImplementation((a) => Promise.resolve(a as any));
      // For liftBan call
      userBanRepo.findOne.mockResolvedValue({
        ...mockBan,
        isActive: true,
        user: mockUser,
      } as any);
      userBanRepo.save.mockImplementation((b) => Promise.resolve(b as any));
      moderationLogRepo.create.mockReturnValue({} as any);
      moderationLogRepo.save.mockResolvedValue({} as any);

      const result = await service.reviewAppeal(
        "appeal-123",
        "mod-123",
        true,
        "User has shown improvement",
      );

      expect(result.status).toBe(AppealStatus.APPROVED);
      expect(result.reviewedById).toBe("mod-123");
      expect(result.reviewedAt).toBeInstanceOf(Date);
    });

    it("should reject appeal without lifting ban", async () => {
      banAppealRepo.findOne.mockResolvedValue({
        ...mockAppeal,
        status: AppealStatus.PENDING,
      } as any);
      banAppealRepo.save.mockImplementation((a) => Promise.resolve(a as any));
      moderationLogRepo.create.mockReturnValue({} as any);
      moderationLogRepo.save.mockResolvedValue({} as any);

      const result = await service.reviewAppeal(
        "appeal-123",
        "mod-123",
        false,
        "Insufficient evidence of reform",
      );

      expect(result.status).toBe(AppealStatus.REJECTED);
      // liftBan should NOT have been called
      expect(userBanRepo.findOne).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException if appeal not found", async () => {
      banAppealRepo.findOne.mockResolvedValue(null);

      await expect(
        service.reviewAppeal("nonexistent", "mod-123", true),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if appeal already reviewed", async () => {
      banAppealRepo.findOne.mockResolvedValue({
        ...mockAppeal,
        status: AppealStatus.APPROVED,
      } as any);

      await expect(
        service.reviewAppeal("appeal-123", "mod-123", true),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getUserAppeals", () => {
    it("should return appeals for a user", async () => {
      const appeals = [mockAppeal];
      banAppealRepo.find.mockResolvedValue(appeals as any);

      const result = await service.getUserAppeals("user-123");

      expect(result).toEqual(appeals);
      expect(banAppealRepo.find).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        relations: ["ban", "reviewedBy"],
        order: { createdAt: "DESC" },
      });
    });
  });

  // ============================================================
  // MODERATION LOGS
  // ============================================================

  describe("getModerationLogs", () => {
    it("should return paginated moderation logs", async () => {
      const logs = [{ id: "log-123", action: ModerationAction.CONTENT_REMOVED }];
      moderationLogRepo.findAndCount.mockResolvedValue([logs as any, 1]);

      const result = await service.getModerationLogs({ page: 1, limit: 20 });

      expect(result.logs).toEqual(logs);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it("should filter by moderatorId", async () => {
      moderationLogRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getModerationLogs({
        page: 1,
        limit: 20,
        moderatorId: "mod-123",
      });

      expect(moderationLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            moderatorId: "mod-123",
          }),
        }),
      );
    });

    it("should filter by action", async () => {
      moderationLogRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getModerationLogs({
        page: 1,
        limit: 20,
        action: ModerationAction.USER_WARNED,
      });

      expect(moderationLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: ModerationAction.USER_WARNED,
          }),
        }),
      );
    });

    it("should cap limit to 50", async () => {
      moderationLogRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getModerationLogs({ page: 1, limit: 200 });

      expect(moderationLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });
  });

  // ============================================================
  // BULK ACTIONS
  // ============================================================

  describe("bulkResolveReports", () => {
    it("should resolve multiple reports", async () => {
      reportRepo.findOne
        .mockResolvedValueOnce({
          ...mockReport,
          status: ModerationStatus.UNDER_REVIEW,
        } as any)
        .mockResolvedValueOnce({
          ...mockReport,
          status: ModerationStatus.UNDER_REVIEW,
        } as any);
      reportRepo.save.mockImplementation((r) => Promise.resolve(r as any));
      moderationLogRepo.create.mockReturnValue({} as any);
      moderationLogRepo.save.mockResolvedValue({} as any);

      const result = await service.bulkResolveReports(
        ["report-1", "report-2"],
        "mod-123",
        ModerationAction.DISMISSED,
      );

      expect(result.resolved).toBe(2);
      expect(result.failed).toEqual([]);
    });

    it("should track failed resolutions", async () => {
      reportRepo.findOne
        .mockResolvedValueOnce({
          ...mockReport,
          status: ModerationStatus.UNDER_REVIEW,
        } as any)
        .mockResolvedValueOnce(null); // second report not found
      reportRepo.save.mockImplementation((r) => Promise.resolve(r as any));
      moderationLogRepo.create.mockReturnValue({} as any);
      moderationLogRepo.save.mockResolvedValue({} as any);

      const result = await service.bulkResolveReports(
        ["report-1", "report-2"],
        "mod-123",
        ModerationAction.DISMISSED,
      );

      expect(result.resolved).toBe(1);
      expect(result.failed).toEqual(["report-2"]);
    });
  });

  describe("bulkAssignReports", () => {
    it("should assign multiple reports", async () => {
      reportRepo.findOne.mockResolvedValue({
        ...mockReport,
        status: ModerationStatus.PENDING,
      } as any);
      userRepo.findOne.mockResolvedValue(mockModerator as any);
      reportRepo.save.mockImplementation((r) => Promise.resolve(r as any));

      const result = await service.bulkAssignReports(
        ["report-1", "report-2"],
        "mod-123",
      );

      expect(result.assigned).toBe(2);
      expect(result.failed).toEqual([]);
    });
  });

  describe("bulkIssueWarnings", () => {
    it("should issue warnings to multiple users", async () => {
      userRepo.findOne.mockResolvedValue(mockUser as any);
      userWarningRepo.create.mockReturnValue(mockWarning as any);
      userWarningRepo.save.mockResolvedValue(mockWarning as any);
      moderationLogRepo.create.mockReturnValue({} as any);
      moderationLogRepo.save.mockResolvedValue({} as any);

      const result = await service.bulkIssueWarnings(
        ["user-1", "user-2"],
        "mod-123",
        ReportReason.SPAM,
        "Stop spamming",
      );

      expect(result.issued).toBe(2);
      expect(result.failed).toEqual([]);
    });

    it("should track failed warnings", async () => {
      userRepo.findOne
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce(null); // second user not found
      userWarningRepo.create.mockReturnValue(mockWarning as any);
      userWarningRepo.save.mockResolvedValue(mockWarning as any);
      moderationLogRepo.create.mockReturnValue({} as any);
      moderationLogRepo.save.mockResolvedValue({} as any);

      const result = await service.bulkIssueWarnings(
        ["user-1", "user-2"],
        "mod-123",
        ReportReason.SPAM,
        "Stop spamming",
      );

      expect(result.issued).toBe(1);
      expect(result.failed).toEqual(["user-2"]);
    });
  });

  // ============================================================
  // PRIORITY SCORING
  // ============================================================

  describe("calculateReportPriority", () => {
    it("should assign higher score to self-harm reports", () => {
      const report = {
        ...mockReport,
        reason: ReportReason.SELF_HARM,
        contentType: ModerationContentType.MESSAGE,
        createdAt: new Date(), // very recent
      } as Report;

      const score = service.calculateReportPriority(report);

      // SELF_HARM (60) + MESSAGE (20) + recency (<1 hour = 20) = 100 (capped)
      expect(score).toBe(100);
    });

    it("should assign lower score to old spam reports", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 5); // 5 days old

      const report = {
        ...mockReport,
        reason: ReportReason.SPAM,
        contentType: ModerationContentType.STORY,
        createdAt: oldDate,
      } as Report;

      const score = service.calculateReportPriority(report);

      // SPAM (20) + STORY (10) + recency (>72h = 0) = 30
      expect(score).toBe(30);
    });

    it("should cap score at 100", () => {
      const report = {
        ...mockReport,
        reason: ReportReason.SELF_HARM,
        contentType: ModerationContentType.USER_PROFILE,
        createdAt: new Date(), // very recent
      } as Report;

      const score = service.calculateReportPriority(report);

      expect(score).toBeLessThanOrEqual(100);
    });

    it("should give recency bonus for reports within 6 hours", () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

      const report = {
        ...mockReport,
        reason: ReportReason.OTHER,
        contentType: ModerationContentType.STORY,
        createdAt: threeHoursAgo,
      } as Report;

      const score = service.calculateReportPriority(report);

      // OTHER (15) + STORY (10) + recency (1-6h = 15) = 40
      expect(score).toBe(40);
    });
  });

  // ============================================================
  // STRIKE SYSTEM
  // ============================================================

  describe("getUserStrikeCount", () => {
    it("should return warning count in last 90 days", async () => {
      userWarningRepo.count.mockResolvedValue(2);

      const result = await service.getUserStrikeCount("user-123");

      expect(result).toBe(2);
      expect(userWarningRepo.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "user-123",
          }),
        }),
      );
    });
  });

  describe("checkAutoban", () => {
    it("should auto-ban user with 3+ strikes", async () => {
      userWarningRepo.count.mockResolvedValue(3);
      userBanRepo.findOne.mockResolvedValue(null); // not already banned
      userRepo.findOne.mockResolvedValue(mockUser as any);
      userBanRepo.create.mockReturnValue(mockBan as any);
      userBanRepo.save.mockResolvedValue(mockBan as any);
      moderationLogRepo.create.mockReturnValue({} as any);
      moderationLogRepo.save.mockResolvedValue({} as any);

      const result = await service.checkAutoban("user-123", "system");

      expect(result).toBe(true);
    });

    it("should not auto-ban user with fewer than 3 strikes", async () => {
      userWarningRepo.count.mockResolvedValue(2);

      const result = await service.checkAutoban("user-123", "system");

      expect(result).toBe(false);
    });

    it("should not auto-ban already-banned user", async () => {
      userWarningRepo.count.mockResolvedValue(5);
      userBanRepo.findOne.mockResolvedValue(mockBan as any); // already banned

      const result = await service.checkAutoban("user-123", "system");

      expect(result).toBe(false);
    });
  });

  // ============================================================
  // STATS
  // ============================================================

  describe("getModerationStats", () => {
    it("should return dashboard statistics", async () => {
      reportRepo.count
        .mockResolvedValueOnce(5)   // pending
        .mockResolvedValueOnce(3)   // under review
        .mockResolvedValueOnce(10); // resolved today
      userBanRepo.count.mockResolvedValue(2);
      (userWarningRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(7),
      });
      contentFlagRepo.count.mockResolvedValue(4);
      (reportRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { reason: ReportReason.SPAM, count: "3" },
          { reason: ReportReason.HARASSMENT, count: "2" },
        ]),
      });
      (moderationLogRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { action: ModerationAction.CONTENT_REMOVED, count: "5" },
        ]),
      });

      const result = await service.getModerationStats();

      expect(result.pendingReports).toBe(5);
      expect(result.underReviewReports).toBe(3);
      expect(result.resolvedToday).toBe(10);
      expect(result.totalActiveBans).toBe(2);
      expect(result.totalActiveWarnings).toBe(7);
      expect(result.pendingFlags).toBe(4);
      expect(result.reportsByReason).toEqual({
        [ReportReason.SPAM]: 3,
        [ReportReason.HARASSMENT]: 2,
      });
      expect(result.actionsTakenToday).toEqual({
        [ModerationAction.CONTENT_REMOVED]: 5,
      });
    });
  });
});
