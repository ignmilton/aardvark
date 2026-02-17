import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, Not, IsNull, DataSource } from "typeorm";
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { RatingsService } from "./ratings.service";
import {
  Rating,
  Story,
  ReaderProgress,
  Transaction,
  User,
} from "@/database/entities";

// Mock ESM-only dependencies that ts-jest cannot transform
jest.mock("marked", () => ({
  marked: {
    parse: jest.fn().mockReturnValue("<p>mocked</p>"),
  },
}));
jest.mock("sanitize-html", () => jest.fn().mockReturnValue("<p>mocked</p>"));

describe("RatingsService", () => {
  let service: RatingsService;
  let ratingRepo: jest.Mocked<Repository<Rating>>;
  let storyRepo: jest.Mocked<Repository<Story>>;
  let progressRepo: jest.Mocked<Repository<ReaderProgress>>;
  let transactionRepo: jest.Mocked<Repository<Transaction>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let dataSource: jest.Mocked<DataSource>;

  // Transaction manager repos (used inside dataSource.transaction callback)
  let txManagerUserRepo: Record<string, jest.Mock>;
  let txManagerTxRepo: Record<string, jest.Mock>;

  const mockUser = {
    id: "user-123",
    username: "reviewer",
    displayName: "Test Reviewer",
    avatarUrl: "https://example.com/avatar.png",
    creditsBalance: 100,
  };

  const mockStory: Partial<Story> = {
    id: "story-123",
    title: "Test Story",
    authorId: "author-999",
    averageRating: 0,
    ratingsCount: 0,
  };

  const mockRating: Partial<Rating> = {
    id: "rating-1",
    userId: "user-123",
    storyId: "story-123",
    rating: 5,
    reviewTitle: "Great story!",
    reviewText: "This was an amazing interactive fiction experience.",
    reviewHtml: "<p>mocked</p>",
    helpfulCount: 42,
    isFeatured: true,
    isVerifiedReader: true,
    isEdited: false,
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-01-15"),
  };

  const mockRatingWithUser: Partial<Rating> = {
    ...mockRating,
    user: mockUser as any,
  };

  const mockFeaturedRating = {
    id: "rating-1",
    userId: "user-123",
    storyId: "story-123",
    rating: 5,
    reviewTitle: "Great story!",
    reviewText: "This was an amazing interactive fiction experience.",
    reviewHtml: "<p>This was an amazing interactive fiction experience.</p>",
    helpfulCount: 42,
    isFeatured: true,
    isVerifiedReader: true,
    isEdited: false,
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-01-15"),
    user: mockUser,
  };

  const mockFeaturedRating2 = {
    id: "rating-2",
    userId: "user-456",
    storyId: "story-123",
    rating: 4,
    reviewTitle: "Solid branching narrative",
    reviewText: "Well-crafted choices with meaningful consequences.",
    reviewHtml: "<p>Well-crafted choices with meaningful consequences.</p>",
    helpfulCount: 18,
    isFeatured: true,
    isVerifiedReader: true,
    isEdited: false,
    createdAt: new Date("2026-01-20"),
    updatedAt: new Date("2026-01-20"),
    user: {
      id: "user-456",
      username: "reader2",
      displayName: "Another Reader",
      avatarUrl: null,
    },
  };

  const mockFeaturedRating3 = {
    id: "rating-3",
    userId: "user-789",
    storyId: "story-123",
    rating: 5,
    reviewTitle: "Must read",
    reviewText: "One of the best stories on the platform.",
    reviewHtml: "<p>One of the best stories on the platform.</p>",
    helpfulCount: 7,
    isFeatured: true,
    isVerifiedReader: false,
    isEdited: false,
    createdAt: new Date("2026-02-01"),
    updatedAt: new Date("2026-02-01"),
    user: {
      id: "user-789",
      username: "reader3",
      displayName: "Third Reader",
      avatarUrl: null,
    },
  };

  // QueryBuilder mock that can be reconfigured per test
  let mockQueryBuilder: Record<string, jest.Mock>;

  beforeEach(async () => {
    // Build transaction manager repository mocks
    txManagerUserRepo = {
      findOne: jest.fn().mockResolvedValue({ ...mockUser }),
      update: jest.fn().mockResolvedValue(undefined),
    };

    txManagerTxRepo = {
      create: jest.fn().mockReturnValue({ id: "tx-123" }),
      save: jest.fn().mockResolvedValue({ id: "tx-123" }),
    };

    const mockTransactionManager = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === User) return txManagerUserRepo;
        if (entity === Transaction) return txManagerTxRepo;
        return {};
      }),
    };

    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        average: "4.5",
        count: "10",
      }),
      getRawMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingsService,
        {
          provide: getRepositoryToken(Rating),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            count: jest.fn(),
            increment: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(Story),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ReaderProgress),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            count: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
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
          provide: DataSource,
          useValue: {
            transaction: jest.fn((cb) => cb(mockTransactionManager)),
          },
        },
      ],
    }).compile();

    service = module.get<RatingsService>(RatingsService);
    ratingRepo = module.get(getRepositoryToken(Rating));
    storyRepo = module.get(getRepositoryToken(Story));
    progressRepo = module.get(getRepositoryToken(ReaderProgress));
    transactionRepo = module.get(getRepositoryToken(Transaction));
    userRepo = module.get(getRepositoryToken(User));
    dataSource = module.get(DataSource);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  // ===========================================================================
  // create()
  // ===========================================================================

  describe("create", () => {
    const createDto = {
      storyId: "story-123",
      rating: 4.5,
      reviewTitle: "Great story!",
      reviewText: "This was an amazing interactive fiction experience that I really enjoyed.",
    };

    beforeEach(() => {
      storyRepo.findOne.mockResolvedValue(mockStory as Story);
      ratingRepo.findOne
        .mockResolvedValueOnce(null) // No existing rating (duplicate check)
        .mockResolvedValueOnce(mockRatingWithUser as Rating); // Final load with user relation
      progressRepo.findOne.mockResolvedValue(null);
      ratingRepo.create.mockReturnValue(mockRating as Rating);
      ratingRepo.save.mockResolvedValue(mockRating as Rating);
      transactionRepo.count.mockResolvedValue(0);
    });

    it("should create a new rating successfully", async () => {
      const result = await service.create(createDto, "user-123");

      // Verify story existence check
      expect(storyRepo.findOne).toHaveBeenCalledWith({
        where: { id: "story-123" },
      });

      // Verify duplicate check
      expect(ratingRepo.findOne).toHaveBeenCalledWith({
        where: { userId: "user-123", storyId: "story-123" },
      });

      // Verify the rating was created with correct fields
      expect(ratingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          storyId: "story-123",
          rating: 4.5,
          reviewTitle: "Great story!",
          reviewText: "This was an amazing interactive fiction experience that I really enjoyed.",
          reviewHtml: "<p>mocked</p>",
          isVerifiedReader: false,
        }),
      );

      expect(ratingRepo.save).toHaveBeenCalledWith(mockRating);

      // Final result loaded with user relation
      expect(result).toEqual(mockRatingWithUser);
    });

    it("should set isVerifiedReader to true when user has completed the story", async () => {
      progressRepo.findOne.mockResolvedValue({
        userId: "user-123",
        storyId: "story-123",
        isCompleted: true,
      } as any);

      await service.create(createDto, "user-123");

      expect(ratingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isVerifiedReader: true,
        }),
      );
    });

    it("should set isVerifiedReader to false when user has not completed the story", async () => {
      progressRepo.findOne.mockResolvedValue({
        userId: "user-123",
        storyId: "story-123",
        isCompleted: false,
      } as any);

      await service.create(createDto, "user-123");

      expect(ratingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isVerifiedReader: false,
        }),
      );
    });

    it("should set isVerifiedReader to false when no progress record exists", async () => {
      progressRepo.findOne.mockResolvedValue(null);

      await service.create(createDto, "user-123");

      expect(ratingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isVerifiedReader: false,
        }),
      );
    });

    it("should throw ConflictException when user has already rated the story", async () => {
      // Reset and set up: existing rating found for the duplicate check
      ratingRepo.findOne.mockReset();
      ratingRepo.findOne.mockResolvedValue(mockRating as Rating);

      await expect(service.create(createDto, "user-123")).rejects.toThrow(
        ConflictException,
      );

      // Rating should not be created
      expect(ratingRepo.create).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when story does not exist", async () => {
      storyRepo.findOne.mockResolvedValue(null);

      await expect(service.create(createDto, "user-123")).rejects.toThrow(
        NotFoundException,
      );

      // Should not check for existing rating
      expect(ratingRepo.findOne).not.toHaveBeenCalled();
    });

    it("should handle rating without review text (rating only, no review)", async () => {
      const ratingOnlyDto = {
        storyId: "story-123",
        rating: 3,
      };

      const ratingOnlyResult = {
        ...mockRating,
        reviewTitle: null,
        reviewText: null,
        reviewHtml: null,
      };

      ratingRepo.create.mockReturnValue(ratingOnlyResult as Rating);
      ratingRepo.save.mockResolvedValue(ratingOnlyResult as Rating);

      await service.create(ratingOnlyDto, "user-123");

      expect(ratingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewTitle: null,
          reviewText: null,
          reviewHtml: null,
        }),
      );
    });

    it("should process review text through markdown and sanitize when provided", async () => {
      await service.create(createDto, "user-123");

      // The create call should include processed reviewHtml
      expect(ratingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewHtml: "<p>mocked</p>",
        }),
      );
    });

    it("should update story rating stats after creating a rating", async () => {
      await service.create(createDto, "user-123");

      // updateStoryRatingStats calls createQueryBuilder for AVG/COUNT, then storyRepo.update
      expect(ratingRepo.createQueryBuilder).toHaveBeenCalled();
      expect(storyRepo.update).toHaveBeenCalledWith("story-123", {
        averageRating: 4.5,
        ratingsCount: 10,
      });
    });

    it("should award review credit when review text is >= 50 characters", async () => {
      // transactionRepo.count = 0 means daily limit not exceeded
      transactionRepo.count.mockResolvedValue(0);

      await service.create(createDto, "user-123");

      // Should use a database transaction for credit awarding
      expect(dataSource.transaction).toHaveBeenCalled();

      // Verify the user was looked up inside the transaction with a lock
      expect(txManagerUserRepo.findOne).toHaveBeenCalledWith({
        where: { id: "user-123" },
        lock: { mode: "pessimistic_write" },
      });

      // Verify user balance was updated (100 + 1 = 101)
      expect(txManagerUserRepo.update).toHaveBeenCalledWith("user-123", {
        creditsBalance: 101,
      });

      // Verify transaction record was created
      expect(txManagerTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          amount: 1,
          balance: 101,
          referenceType: "rating",
        }),
      );
      expect(txManagerTxRepo.save).toHaveBeenCalled();
    });

    it("should not award review credit when review text is less than 50 characters", async () => {
      const shortReviewDto = {
        storyId: "story-123",
        rating: 4,
        reviewText: "Short review",
      };

      ratingRepo.findOne.mockReset();
      ratingRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockRatingWithUser as Rating);

      await service.create(shortReviewDto, "user-123");

      // Transaction should NOT be called for credit awarding
      // (the only transaction is for updateStoryRatingStats which uses createQueryBuilder)
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it("should not award review credit when no review text is provided", async () => {
      const noReviewDto = {
        storyId: "story-123",
        rating: 4,
      };

      ratingRepo.findOne.mockReset();
      ratingRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockRatingWithUser as Rating);

      await service.create(noReviewDto, "user-123");

      // No credit transaction
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it("should not award review credit when daily limit is reached", async () => {
      // 5 = maxReviewRewardsPerDay (from DEFAULT_CREDIT_CONFIG)
      transactionRepo.count.mockResolvedValue(5);

      await service.create(createDto, "user-123");

      // The transaction for credit awarding should still be attempted but the inner logic
      // returns early before calling dataSource.transaction for the credit award
      expect(txManagerUserRepo.update).not.toHaveBeenCalled();
      expect(txManagerTxRepo.save).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // update()
  // ===========================================================================

  describe("update", () => {
    const updateDto = {
      rating: 3,
      reviewTitle: "Updated title",
      reviewText: "Updated review text that is a bit longer.",
    };

    const existingRating: Partial<Rating> = {
      id: "rating-1",
      userId: "user-123",
      storyId: "story-123",
      rating: 5,
      reviewTitle: "Great story!",
      reviewText: "Original review text.",
      reviewHtml: "<p>Original review text.</p>",
      isEdited: false,
      user: mockUser as any,
    };

    beforeEach(() => {
      ratingRepo.findOne.mockResolvedValue({ ...existingRating } as Rating);
      ratingRepo.save.mockImplementation(async (rating) => rating as Rating);
    });

    it("should update the rating successfully", async () => {
      const result = await service.update("rating-1", updateDto, "user-123");

      expect(ratingRepo.findOne).toHaveBeenCalledWith({
        where: { id: "rating-1" },
        relations: ["user"],
      });

      expect(ratingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          rating: 3,
          reviewTitle: "Updated title",
          reviewText: "Updated review text that is a bit longer.",
          reviewHtml: "<p>mocked</p>",
          isEdited: true,
        }),
      );

      expect(result.isEdited).toBe(true);
      expect(result.rating).toBe(3);
    });

    it("should mark the rating as edited", async () => {
      const result = await service.update(
        "rating-1",
        { rating: 4 },
        "user-123",
      );

      expect(result.isEdited).toBe(true);
    });

    it("should update only the rating value when only rating is provided", async () => {
      await service.update("rating-1", { rating: 2 }, "user-123");

      expect(ratingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          rating: 2,
          // Original review text and title should remain unchanged
          reviewTitle: "Great story!",
          reviewText: "Original review text.",
        }),
      );
    });

    it("should update only the review text when only reviewText is provided", async () => {
      await service.update(
        "rating-1",
        { reviewText: "New review content." },
        "user-123",
      );

      expect(ratingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          rating: 5, // Original rating unchanged
          reviewText: "New review content.",
          reviewHtml: "<p>mocked</p>",
        }),
      );
    });

    it("should set reviewTitle to null when empty string is provided", async () => {
      await service.update(
        "rating-1",
        { reviewTitle: "" },
        "user-123",
      );

      expect(ratingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewTitle: null,
        }),
      );
    });

    it("should set reviewText and reviewHtml to null when empty string is provided for reviewText", async () => {
      await service.update(
        "rating-1",
        { reviewText: "" },
        "user-123",
      );

      expect(ratingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewText: null,
          reviewHtml: null,
        }),
      );
    });

    it("should update story rating stats after updating", async () => {
      await service.update("rating-1", updateDto, "user-123");

      expect(storyRepo.update).toHaveBeenCalledWith("story-123", {
        averageRating: 4.5,
        ratingsCount: 10,
      });
    });

    it("should throw NotFoundException when rating does not exist", async () => {
      ratingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update("nonexistent-id", updateDto, "user-123"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException when user does not own the rating", async () => {
      await expect(
        service.update("rating-1", updateDto, "other-user-456"),
      ).rejects.toThrow(ForbiddenException);

      // Should not save
      expect(ratingRepo.save).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // delete()
  // ===========================================================================

  describe("delete", () => {
    const ratingToDelete: Partial<Rating> = {
      id: "rating-1",
      userId: "user-123",
      storyId: "story-123",
      rating: 5,
    };

    beforeEach(() => {
      ratingRepo.findOne.mockResolvedValue({ ...ratingToDelete } as Rating);
      ratingRepo.remove.mockResolvedValue(ratingToDelete as Rating);
    });

    it("should delete the rating successfully", async () => {
      await service.delete("rating-1", "user-123");

      expect(ratingRepo.findOne).toHaveBeenCalledWith({
        where: { id: "rating-1" },
      });

      expect(ratingRepo.remove).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "rating-1",
          userId: "user-123",
        }),
      );
    });

    it("should update story rating stats after deleting", async () => {
      await service.delete("rating-1", "user-123");

      expect(ratingRepo.createQueryBuilder).toHaveBeenCalled();
      expect(storyRepo.update).toHaveBeenCalledWith("story-123", {
        averageRating: 4.5,
        ratingsCount: 10,
      });
    });

    it("should throw NotFoundException when rating does not exist", async () => {
      ratingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.delete("nonexistent-id", "user-123"),
      ).rejects.toThrow(NotFoundException);

      // Should not call remove
      expect(ratingRepo.remove).not.toHaveBeenCalled();
    });

    it("should throw ForbiddenException when user does not own the rating", async () => {
      await expect(
        service.delete("rating-1", "other-user-456"),
      ).rejects.toThrow(ForbiddenException);

      // Should not call remove
      expect(ratingRepo.remove).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // findAll() — paginated ratings query
  // ===========================================================================

  describe("findAll", () => {
    const mockRatingsPage = [
      {
        ...mockRating,
        user: {
          id: "user-123",
          username: "reviewer",
          displayName: "Test Reviewer",
          avatarUrl: "https://example.com/avatar.png",
        },
      },
    ];

    beforeEach(() => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        mockRatingsPage,
        1,
      ]);
    });

    it("should return paginated ratings with meta information", async () => {
      const result = await service.findAll({
        storyId: "story-123",
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it("should filter by storyId", async () => {
      await service.findAll({ storyId: "story-123" });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "rating.storyId = :storyId",
        { storyId: "story-123" },
      );
    });

    it("should filter by userId", async () => {
      await service.findAll({ userId: "user-123" });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "rating.userId = :userId",
        { userId: "user-123" },
      );
    });

    it("should filter by withReview (only ratings with review text)", async () => {
      await service.findAll({ withReview: true });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "rating.reviewText IS NOT NULL",
      );
    });

    it("should filter by minRating", async () => {
      await service.findAll({ minRating: 4 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "rating.rating >= :minRating",
        { minRating: 4 },
      );
    });

    it("should sort by recent (createdAt DESC) by default", async () => {
      await service.findAll({});

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        "rating.createdAt",
        "DESC",
      );
    });

    it("should sort by helpful when sortBy is 'helpful'", async () => {
      await service.findAll({ sortBy: "helpful" });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        "rating.helpfulCount",
        "DESC",
      );
    });

    it("should sort by rating_high when sortBy is 'rating_high'", async () => {
      await service.findAll({ sortBy: "rating_high" });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        "rating.rating",
        "DESC",
      );
    });

    it("should sort by rating_low when sortBy is 'rating_low'", async () => {
      await service.findAll({ sortBy: "rating_low" });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        "rating.rating",
        "ASC",
      );
    });

    it("should apply correct pagination offset and limit", async () => {
      await service.findAll({ page: 3, limit: 10 });

      // skip = (3 - 1) * 10 = 20
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it("should use default page 1 and limit 20 when not provided", async () => {
      await service.findAll({});

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
    });

    it("should left join the user relation", async () => {
      await service.findAll({ storyId: "story-123" });

      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        "rating.user",
        "user",
      );
    });

    it("should calculate totalPages correctly", async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        mockRatingsPage,
        45,
      ]);

      const result = await service.findAll({ limit: 10 });

      expect(result.meta.totalPages).toBe(5); // ceil(45/10) = 5
    });

    it("should return empty data array when no ratings found", async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ storyId: "story-999" });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it("should sanitize user data in returned ratings", async () => {
      const ratingWithFullUser = {
        ...mockRating,
        user: {
          id: "user-123",
          username: "reviewer",
          displayName: "Test Reviewer",
          avatarUrl: "https://example.com/avatar.png",
          email: "should-be-stripped@example.com",
          passwordHash: "secret-hash",
        },
      };

      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        [ratingWithFullUser],
        1,
      ]);

      const result = await service.findAll({ storyId: "story-123" });

      // The sanitizeRating method should strip sensitive user fields
      const returnedUser = (result.data[0] as any).user;
      expect(returnedUser.id).toBe("user-123");
      expect(returnedUser.username).toBe("reviewer");
      expect(returnedUser.displayName).toBe("Test Reviewer");
      expect(returnedUser.avatarUrl).toBe("https://example.com/avatar.png");
      expect(returnedUser.email).toBeUndefined();
      expect(returnedUser.passwordHash).toBeUndefined();
    });
  });

  // ===========================================================================
  // getUserRating()
  // ===========================================================================

  describe("getUserRating", () => {
    it("should return the user's rating for a story", async () => {
      ratingRepo.findOne.mockResolvedValue(mockRating as Rating);

      const result = await service.getUserRating("story-123", "user-123");

      expect(ratingRepo.findOne).toHaveBeenCalledWith({
        where: { storyId: "story-123", userId: "user-123" },
      });

      expect(result).toEqual(mockRating);
    });

    it("should return null when user has not rated the story", async () => {
      ratingRepo.findOne.mockResolvedValue(null);

      const result = await service.getUserRating("story-123", "user-123");

      expect(ratingRepo.findOne).toHaveBeenCalledWith({
        where: { storyId: "story-123", userId: "user-123" },
      });

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // findById()
  // ===========================================================================

  describe("findById", () => {
    it("should return a rating by ID with user and story relations", async () => {
      const ratingWithRelations = {
        ...mockRating,
        user: {
          id: "user-123",
          username: "reviewer",
          displayName: "Test Reviewer",
          avatarUrl: "https://example.com/avatar.png",
        },
        story: mockStory,
      };

      ratingRepo.findOne.mockResolvedValue(ratingWithRelations as any);

      const result = await service.findById("rating-1");

      expect(ratingRepo.findOne).toHaveBeenCalledWith({
        where: { id: "rating-1" },
        relations: ["user", "story"],
      });

      expect(result).toBeDefined();
      expect((result as any).id).toBe("rating-1");
    });

    it("should throw NotFoundException when rating does not exist", async () => {
      ratingRepo.findOne.mockResolvedValue(null);

      await expect(service.findById("nonexistent-id")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should sanitize user data in returned rating", async () => {
      const ratingWithFullUser = {
        ...mockRating,
        user: {
          id: "user-123",
          username: "reviewer",
          displayName: "Test Reviewer",
          avatarUrl: null,
          email: "secret@example.com",
          passwordHash: "hash-to-strip",
        },
        story: mockStory,
      };

      ratingRepo.findOne.mockResolvedValue(ratingWithFullUser as any);

      const result = await service.findById("rating-1");

      const returnedUser = (result as any).user;
      expect(returnedUser.id).toBe("user-123");
      expect(returnedUser.username).toBe("reviewer");
      expect(returnedUser.email).toBeUndefined();
      expect(returnedUser.passwordHash).toBeUndefined();
    });
  });

  // ===========================================================================
  // getRatingDistribution()
  // ===========================================================================

  describe("getRatingDistribution", () => {
    it("should return distribution, average, and total for a story", async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { rating: "5", count: "10" },
        { rating: "4", count: "5" },
        { rating: "3", count: "3" },
        { rating: "2", count: "1" },
        { rating: "1", count: "1" },
      ]);

      const result = await service.getRatingDistribution("story-123");

      expect(result.total).toBe(20);
      // (5*10 + 4*5 + 3*3 + 2*1 + 1*1) / 20 = (50+20+9+2+1)/20 = 82/20 = 4.1
      expect(result.average).toBe(4.1);
      expect(result.distribution).toHaveLength(5);

      // Distribution should be ordered 5,4,3,2,1
      expect(result.distribution[0].rating).toBe(5);
      expect(result.distribution[0].count).toBe(10);
      expect(result.distribution[0].percentage).toBe(50); // 10/20 * 100

      expect(result.distribution[1].rating).toBe(4);
      expect(result.distribution[1].count).toBe(5);
      expect(result.distribution[1].percentage).toBe(25); // 5/20 * 100

      expect(result.distribution[4].rating).toBe(1);
      expect(result.distribution[4].count).toBe(1);
      expect(result.distribution[4].percentage).toBe(5); // 1/20 * 100
    });

    it("should handle empty distribution (no ratings)", async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.getRatingDistribution("story-123");

      expect(result.total).toBe(0);
      expect(result.average).toBe(0);
      expect(result.distribution).toHaveLength(5);

      // All counts and percentages should be 0
      result.distribution.forEach((d) => {
        expect(d.count).toBe(0);
        expect(d.percentage).toBe(0);
      });
    });

    it("should handle partial distribution (only some star ratings present)", async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { rating: "5", count: "8" },
        { rating: "3", count: "2" },
      ]);

      const result = await service.getRatingDistribution("story-123");

      expect(result.total).toBe(10);
      // (5*8 + 3*2) / 10 = 46/10 = 4.6
      expect(result.average).toBe(4.6);

      // Stars 4, 2, 1 should have count 0
      const fourStar = result.distribution.find((d) => d.rating === 4);
      expect(fourStar!.count).toBe(0);
      expect(fourStar!.percentage).toBe(0);

      const fiveStar = result.distribution.find((d) => d.rating === 5);
      expect(fiveStar!.count).toBe(8);
      expect(fiveStar!.percentage).toBe(80);
    });

    it("should query with correct storyId filter", async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      await service.getRatingDistribution("story-abc");

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "rating.storyId = :storyId",
        { storyId: "story-abc" },
      );
    });

    it("should round average to one decimal place", async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { rating: "5", count: "1" },
        { rating: "4", count: "1" },
        { rating: "3", count: "1" },
      ]);

      const result = await service.getRatingDistribution("story-123");

      // (5+4+3)/3 = 12/3 = 4.0
      expect(result.average).toBe(4);
    });
  });

  // ===========================================================================
  // markHelpful()
  // ===========================================================================

  describe("markHelpful", () => {
    it("should increment helpfulCount by 1", async () => {
      ratingRepo.increment.mockResolvedValue(undefined as any);

      await service.markHelpful("rating-1", "user-456");

      expect(ratingRepo.increment).toHaveBeenCalledWith(
        { id: "rating-1" },
        "helpfulCount",
        1,
      );
    });

    it("should accept any userId (no self-vote restriction in current implementation)", async () => {
      ratingRepo.increment.mockResolvedValue(undefined as any);

      // Even the rating owner can mark as helpful in current implementation
      await service.markHelpful("rating-1", "user-123");

      expect(ratingRepo.increment).toHaveBeenCalledWith(
        { id: "rating-1" },
        "helpfulCount",
        1,
      );
    });
  });

  // ===========================================================================
  // getFeaturedReviews()
  // ===========================================================================

  describe("getFeaturedReviews", () => {
    it("should query with Not(IsNull()) filter for reviewText", async () => {
      ratingRepo.find.mockResolvedValue([]);

      await service.getFeaturedReviews("story-123");

      expect(ratingRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reviewText: Not(IsNull()),
          }),
        }),
      );
    });

    it("should return ratings with featured flag and review text", async () => {
      const featuredRatings = [
        mockFeaturedRating,
        mockFeaturedRating2,
        mockFeaturedRating3,
      ];
      ratingRepo.find.mockResolvedValue(featuredRatings as any);

      const result = await service.getFeaturedReviews("story-123");

      expect(result).toHaveLength(3);
      expect(result).toEqual(featuredRatings);

      // Verify the query filters for featured and the correct storyId
      expect(ratingRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            storyId: "story-123",
            isFeatured: true,
            reviewText: Not(IsNull()),
          },
          relations: ["user"],
        }),
      );

      // All returned ratings should have review text (not null)
      result.forEach((rating) => {
        expect(rating.reviewText).not.toBeNull();
        expect(rating.isFeatured).toBe(true);
      });
    });

    it("should respect the limit parameter", async () => {
      const singleRating = [mockFeaturedRating];
      ratingRepo.find.mockResolvedValue(singleRating as any);

      await service.getFeaturedReviews("story-123", 1);

      expect(ratingRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
        }),
      );
    });

    it("should use default limit of 3 when not specified", async () => {
      ratingRepo.find.mockResolvedValue([]);

      await service.getFeaturedReviews("story-123");

      expect(ratingRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 3,
        }),
      );
    });

    it("should order by helpfulCount DESC", async () => {
      const ratingsOrderedByHelpful = [
        mockFeaturedRating, // helpfulCount: 42
        mockFeaturedRating2, // helpfulCount: 18
        mockFeaturedRating3, // helpfulCount: 7
      ];
      ratingRepo.find.mockResolvedValue(ratingsOrderedByHelpful as any);

      await service.getFeaturedReviews("story-123");

      expect(ratingRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { helpfulCount: "DESC" },
        }),
      );
    });

    it("should return empty array when no featured reviews exist", async () => {
      ratingRepo.find.mockResolvedValue([]);

      const result = await service.getFeaturedReviews("story-123");

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });
});
