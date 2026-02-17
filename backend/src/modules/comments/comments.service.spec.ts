import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import {
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";

// Mock ESM-only dependencies before importing the service
jest.mock("marked", () => ({
  marked: {
    parse: jest.fn().mockReturnValue("<p>mocked html</p>"),
  },
}));
jest.mock("sanitize-html", () =>
  jest.fn().mockImplementation((html: string) => html),
);

import { CommentsService } from "./comments.service";
import { Comment, Story, CommentLike } from "@/database/entities";
import { UserRole } from "@aardvark/shared";

describe("CommentsService", () => {
  let service: CommentsService;
  let commentRepository: jest.Mocked<Repository<Comment>>;
  let storyRepository: jest.Mocked<Repository<Story>>;
  let commentLikeRepository: jest.Mocked<Repository<CommentLike>>;
  let dataSource: jest.Mocked<DataSource>;

  const mockStory: Partial<Story> = {
    id: "story-uuid-1",
    title: "Test Story",
  };

  const mockComment: Partial<Comment> = {
    id: "comment-uuid-1",
    userId: "user-uuid-1",
    storyId: "story-uuid-1",
    segmentId: null,
    parentCommentId: null,
    content: "Test comment",
    contentHtml: "<p>Test comment</p>",
    likesCount: 0,
    repliesCount: 0,
    isEdited: false,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  const mockCommentWithUser: Partial<Comment> = {
    ...mockComment,
    user: {
      id: "user-uuid-1",
      username: "testuser",
      displayName: "Test User",
      avatarUrl: null,
      role: UserRole.READER,
    } as any,
  };

  // Transaction mock utilities
  let mockTransactionManager: {
    getRepository: jest.Mock;
  };
  let mockCommentTxRepo: Record<string, jest.Mock>;
  let mockStoryTxRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    // Build per-entity transaction repository mocks
    mockCommentTxRepo = {
      save: jest.fn().mockResolvedValue(mockComment),
      increment: jest.fn().mockResolvedValue(undefined),
      decrement: jest.fn().mockResolvedValue(undefined),
    };

    mockStoryTxRepo = {
      increment: jest.fn().mockResolvedValue(undefined),
      decrement: jest.fn().mockResolvedValue(undefined),
    };

    mockTransactionManager = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === Comment) return mockCommentTxRepo;
        if (entity === Story) return mockStoryTxRepo;
        return {};
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        {
          provide: getRepositoryToken(Comment),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
            increment: jest.fn(),
            decrement: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Story),
          useValue: {
            findOne: jest.fn(),
            increment: jest.fn(),
            decrement: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CommentLike),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            remove: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn().mockImplementation(async (cb) => {
              return cb(mockTransactionManager);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
    commentRepository = module.get(getRepositoryToken(Comment));
    storyRepository = module.get(getRepositoryToken(Story));
    commentLikeRepository = module.get(getRepositoryToken(CommentLike));
    dataSource = module.get(DataSource);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  // ==========================================================================
  // create()
  // ==========================================================================
  describe("create", () => {
    const createDto = {
      storyId: "story-uuid-1",
      content: "A new comment",
    };

    beforeEach(() => {
      storyRepository.findOne.mockResolvedValue(mockStory as Story);
      commentRepository.create.mockReturnValue(mockComment as Comment);
      commentRepository.findOne.mockResolvedValue(
        mockCommentWithUser as Comment,
      );
    });

    it("should save comment and increment counters within a transaction", async () => {
      const result = await service.create(createDto, "user-uuid-1");

      // Transaction was invoked
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);

      // Comment was saved via the transaction manager
      expect(mockCommentTxRepo.save).toHaveBeenCalledWith(mockComment);

      // Story comment count was incremented inside the transaction
      expect(mockStoryTxRepo.increment).toHaveBeenCalledWith(
        { id: "story-uuid-1" },
        "commentCount",
        1,
      );

      // Final result is loaded with the user relation
      expect(commentRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockComment.id },
        relations: ["user"],
      });
      expect(result).toEqual(mockCommentWithUser);
    });

    it("should increment parent's repliesCount when parentCommentId is provided", async () => {
      const parentComment: Partial<Comment> = {
        id: "parent-comment-uuid",
        storyId: "story-uuid-1",
        isDeleted: false,
        repliesCount: 2,
      };

      // First findOne call is for the parent comment validation
      commentRepository.findOne
        .mockResolvedValueOnce(parentComment as Comment) // parent check
        .mockResolvedValueOnce(mockCommentWithUser as Comment); // final load

      const dtoWithParent = {
        ...createDto,
        parentCommentId: "parent-comment-uuid",
      };

      await service.create(dtoWithParent, "user-uuid-1");

      // Parent comment's repliesCount was incremented inside transaction
      expect(mockCommentTxRepo.increment).toHaveBeenCalledWith(
        { id: "parent-comment-uuid" },
        "repliesCount",
        1,
      );

      // Story commentCount was still incremented
      expect(mockStoryTxRepo.increment).toHaveBeenCalledWith(
        { id: "story-uuid-1" },
        "commentCount",
        1,
      );
    });

    it("should increment story's commentCount", async () => {
      await service.create(createDto, "user-uuid-1");

      expect(mockStoryTxRepo.increment).toHaveBeenCalledWith(
        { id: "story-uuid-1" },
        "commentCount",
        1,
      );
    });

    it("should throw NotFoundException if story doesn't exist", async () => {
      storyRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto, "user-uuid-1")).rejects.toThrow(
        NotFoundException,
      );

      // Transaction should not have been called
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // delete()
  // ==========================================================================
  describe("delete", () => {
    const commentToDelete: Partial<Comment> = {
      id: "comment-uuid-1",
      userId: "user-uuid-1",
      storyId: "story-uuid-1",
      parentCommentId: null,
      content: "Original content",
      contentHtml: "<p>Original content</p>",
      isDeleted: false,
    };

    beforeEach(() => {
      commentRepository.findOne.mockResolvedValue(
        // Return a fresh copy each test so mutations don't bleed between tests
        { ...commentToDelete } as Comment,
      );
    });

    it("should soft-delete and decrement counters within a transaction", async () => {
      await service.delete("comment-uuid-1", "user-uuid-1", UserRole.READER);

      // Transaction was invoked
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);

      // Comment was saved (soft-deleted) via the transaction manager
      expect(mockCommentTxRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "comment-uuid-1",
          isDeleted: true,
          content: "[deleted]",
          contentHtml: "<p>[deleted]</p>",
        }),
      );

      // Story commentCount was decremented inside the transaction
      expect(mockStoryTxRepo.decrement).toHaveBeenCalledWith(
        { id: "story-uuid-1" },
        "commentCount",
        1,
      );
    });

    it("should decrement parent's repliesCount when parentCommentId exists", async () => {
      const commentWithParent: Partial<Comment> = {
        ...commentToDelete,
        parentCommentId: "parent-comment-uuid",
      };
      commentRepository.findOne.mockResolvedValue(
        { ...commentWithParent } as Comment,
      );

      await service.delete("comment-uuid-1", "user-uuid-1", UserRole.READER);

      // Parent comment's repliesCount was decremented inside transaction
      expect(mockCommentTxRepo.decrement).toHaveBeenCalledWith(
        { id: "parent-comment-uuid" },
        "repliesCount",
        1,
      );

      // Story commentCount was still decremented
      expect(mockStoryTxRepo.decrement).toHaveBeenCalledWith(
        { id: "story-uuid-1" },
        "commentCount",
        1,
      );
    });

    it("should decrement story's commentCount", async () => {
      await service.delete("comment-uuid-1", "user-uuid-1", UserRole.READER);

      expect(mockStoryTxRepo.decrement).toHaveBeenCalledWith(
        { id: "story-uuid-1" },
        "commentCount",
        1,
      );
    });

    it("should throw ForbiddenException if user doesn't own the comment and isn't moderator", async () => {
      await expect(
        service.delete("comment-uuid-1", "other-user-uuid", UserRole.READER),
      ).rejects.toThrow(ForbiddenException);

      // Transaction should not have been called
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it("should allow moderators to delete any comment", async () => {
      await service.delete(
        "comment-uuid-1",
        "moderator-user-uuid",
        UserRole.MODERATOR,
      );

      // Transaction was invoked -- the moderator was allowed through
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);

      // Comment was soft-deleted
      expect(mockCommentTxRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isDeleted: true,
          content: "[deleted]",
        }),
      );
    });
  });
});
