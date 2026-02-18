import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";
import { SearchService } from "./search.service";
import { Story, User, Tag, StoryTag, SearchHistory } from "@/database/entities";

describe("SearchService", () => {
  let service: SearchService;
  let storyRepository: jest.Mocked<Repository<Story>>;

  // Reusable mock for createQueryBuilder chains
  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  // Mock Elasticsearch client
  const mockEsClient = {
    search: jest.fn().mockResolvedValue({
      hits: {
        hits: [],
        total: { value: 0 },
      },
    }),
  };

  beforeEach(async () => {
    // Reset all query builder mocks between tests
    Object.values(mockQueryBuilder).forEach((fn) =>
      (fn as jest.Mock).mockClear(),
    );
    mockQueryBuilder.leftJoinAndSelect.mockReturnThis();
    mockQueryBuilder.where.mockReturnThis();
    mockQueryBuilder.andWhere.mockReturnThis();
    mockQueryBuilder.orderBy.mockReturnThis();
    mockQueryBuilder.addOrderBy.mockReturnThis();
    mockQueryBuilder.skip.mockReturnThis();
    mockQueryBuilder.take.mockReturnThis();
    mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    // Reset ES client mock
    mockEsClient.search.mockClear();
    mockEsClient.search.mockResolvedValue({
      hits: {
        hits: [],
        total: { value: 0 },
      },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({
              node: "http://localhost:9200",
              username: "",
              password: "",
            }),
          },
        },
        {
          provide: getRepositoryToken(Story),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(Tag),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(StoryTag),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SearchHistory),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    storyRepository = module.get(getRepositoryToken(Story));

    // Inject mock ES client and enable connected mode so the ES code path runs
    (service as any).client = mockEsClient;
    (service as any).isConnected = true;
  });

  // ==========================================================================
  // searchStories — pagination caps (ES-connected path)
  // ==========================================================================
  describe("searchStories pagination", () => {
    it("should cap limit to maximum 100", async () => {
      const result = await service.searchStories({
        query: "adventure",
        limit: 500,
        page: 1,
      });

      // The ES search should have been called with size capped at 100
      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            size: 100,
          }),
        }),
      );

      // The returned meta should reflect the capped limit
      expect(result.meta.limit).toBe(100);
    });

    it("should default page to 1", async () => {
      const result = await service.searchStories({
        query: "adventure",
      });

      expect(result.meta.page).toBe(1);

      // from should be 0 for page 1
      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            from: 0,
          }),
        }),
      );
    });

    it("should calculate correct skip value", async () => {
      // Page 3 with limit 20 should skip (3-1)*20 = 40 records
      await service.searchStories({
        query: "adventure",
        page: 3,
        limit: 20,
      });

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            from: 40,
            size: 20,
          }),
        }),
      );
    });

    it("should clamp limit to at least 1 when rawLimit is below 1", async () => {
      const result = await service.searchStories({
        query: "adventure",
        limit: -5,
        page: 1,
      });

      // Math.min(Math.max(1, -5), 100) = Math.min(1, 100) = 1
      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            size: 1,
          }),
        }),
      );
      expect(result.meta.limit).toBe(1);
    });

    it("should fall back to database when ES search throws", async () => {
      mockEsClient.search.mockRejectedValueOnce(new Error("ES down"));

      const result = await service.searchStories({
        query: "adventure",
        page: 1,
        limit: 20,
      });

      // Fallback path uses the story repository query builder
      expect(storyRepository.createQueryBuilder).toHaveBeenCalled();
      expect(result.meta).toBeDefined();
    });
  });

  // ==========================================================================
  // searchUsers — pagination caps (ES-connected path)
  // ==========================================================================
  describe("searchUsers pagination", () => {
    it("should default page to 1 and limit to 20", async () => {
      const result = await service.searchUsers({
        query: "john",
      });

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            from: 0,
            size: 20,
          }),
        }),
      );
    });

    it("should cap user search limit to 100", async () => {
      const result = await service.searchUsers({
        query: "john",
        limit: 200,
        page: 1,
      });

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            size: 100,
          }),
        }),
      );
      expect(result.meta.limit).toBe(100);
    });

    it("should calculate correct skip value for users search", async () => {
      await service.searchUsers({
        query: "john",
        page: 2,
        limit: 10,
      });

      // skip = (2-1)*10 = 10
      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            from: 10,
            size: 10,
          }),
        }),
      );
    });
  });
});
