import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, Not, IsNull, DataSource } from "typeorm";
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
  let _storyRepo: jest.Mocked<Repository<Story>>;
  let _progressRepo: jest.Mocked<Repository<ReaderProgress>>;
  let _transactionRepo: jest.Mocked<Repository<Transaction>>;
  let _userRepo: jest.Mocked<Repository<User>>;

  const mockUser = {
    id: "user-123",
    username: "reviewer",
    displayName: "Test Reviewer",
    avatarUrl: "https://example.com/avatar.png",
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

  beforeEach(async () => {
    const mockTransactionManager = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === User) return _userRepo;
        if (entity === Transaction) return _transactionRepo;
        return {};
      }),
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
            createQueryBuilder: jest.fn().mockReturnValue({
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
            }),
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
    _storyRepo = module.get(getRepositoryToken(Story));
    _progressRepo = module.get(getRepositoryToken(ReaderProgress));
    _transactionRepo = module.get(getRepositoryToken(Transaction));
    _userRepo = module.get(getRepositoryToken(User));
  });

  // ===========================================================================
  // getFeaturedReviews
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
  });
});
