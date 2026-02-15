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

describe("ModerationService", () => {
  let service: ModerationService;
  let reportRepo: jest.Mocked<Repository<Report>>;
  let moderationLogRepo: jest.Mocked<Repository<ModerationLog>>;
  let _userWarningRepo: jest.Mocked<Repository<UserWarning>>;
  let _userBanRepo: jest.Mocked<Repository<UserBan>>;
  let _contentFlagRepo: jest.Mocked<Repository<ContentFlag>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let _banAppealRepo: jest.Mocked<Repository<BanAppeal>>;
  let _userMuteRepo: jest.Mocked<Repository<UserMute>>;

  const mockUser = {
    id: "user-123",
    username: "testuser",
    canModerate: false,
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
    reason: ReportReason.INAPPROPRIATE_CONTENT,
    status: ModerationStatus.PENDING,
    actionTaken: ModerationAction.NONE,
  };

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
          },
        },
        {
          provide: getRepositoryToken(ModerationLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findAndCount: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserWarning),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserBan),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ContentFlag),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
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
    _userWarningRepo = module.get(getRepositoryToken(UserWarning));
    _userBanRepo = module.get(getRepositoryToken(UserBan));
    _contentFlagRepo = module.get(getRepositoryToken(ContentFlag));
    userRepo = module.get(getRepositoryToken(User));
    _banAppealRepo = module.get(getRepositoryToken(BanAppeal));
    _userMuteRepo = module.get(getRepositoryToken(UserMute));
  });

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
});
