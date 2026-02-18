import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Comment, Story, User, CommentLike } from "@/database/entities";
import { CreateCommentDto, UpdateCommentDto, CommentQueryDto } from "./dto";
import { UserRole } from "@aardvark/shared";
import * as sanitizeHtml from "sanitize-html";
import { marked } from "marked";

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(CommentLike)
    private readonly commentLikeRepository: Repository<CommentLike>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a new comment
   */
  async create(createDto: CreateCommentDto, userId: string): Promise<Comment> {
    // Verify story exists
    const story = await this.storyRepository.findOne({
      where: { id: createDto.storyId },
    });
    if (!story) {
      throw new NotFoundException("Story not found");
    }

    // If replying to a comment, verify parent exists
    if (createDto.parentCommentId) {
      const parentComment = await this.commentRepository.findOne({
        where: { id: createDto.parentCommentId, storyId: createDto.storyId },
      });
      if (!parentComment) {
        throw new NotFoundException("Parent comment not found");
      }
      if (parentComment.isDeleted) {
        throw new BadRequestException("Cannot reply to a deleted comment");
      }
    }

    // Convert markdown to HTML and sanitize
    const contentHtml = this.processContent(createDto.content);

    const comment = this.commentRepository.create({
      userId,
      storyId: createDto.storyId,
      segmentId: createDto.segmentId || null,
      parentCommentId: createDto.parentCommentId || null,
      content: createDto.content,
      contentHtml,
    });

    const savedComment = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.getRepository(Comment).save(comment);

      // Increment parent's reply count
      if (createDto.parentCommentId) {
        await manager
          .getRepository(Comment)
          .increment({ id: createDto.parentCommentId }, "repliesCount", 1);
      }

      // Increment story comment count
      await manager
        .getRepository(Story)
        .increment({ id: createDto.storyId }, "commentCount", 1);

      return saved;
    });

    // Load user relation for response
    return this.commentRepository.findOne({
      where: { id: savedComment.id },
      relations: ["user"],
    }) as Promise<Comment>;
  }

  /**
   * Get comments with pagination
   */
  async findAll(query: CommentQueryDto) {
    const {
      storyId,
      segmentId,
      parentCommentId,
      rootOnly,
      page = 1,
      limit: rawLimit = 20,
      sortBy = "recent",
    } = query;
    // Cap limit to prevent resource exhaustion
    const limit = Math.min(Math.max(1, rawLimit), 100);

    const queryBuilder = this.commentRepository
      .createQueryBuilder("comment")
      .leftJoinAndSelect("comment.user", "user")
      .where("comment.isDeleted = :isDeleted", { isDeleted: false });

    if (storyId) {
      queryBuilder.andWhere("comment.storyId = :storyId", { storyId });
    }

    if (segmentId) {
      queryBuilder.andWhere("comment.segmentId = :segmentId", { segmentId });
    }

    if (parentCommentId) {
      queryBuilder.andWhere("comment.parentCommentId = :parentCommentId", {
        parentCommentId,
      });
    } else if (rootOnly) {
      queryBuilder.andWhere("comment.parentCommentId IS NULL");
    }

    // Sorting
    switch (sortBy) {
      case "oldest":
        queryBuilder.orderBy("comment.createdAt", "ASC");
        break;
      case "likes":
        queryBuilder.orderBy("comment.likesCount", "DESC");
        break;
      case "recent":
      default:
        queryBuilder.orderBy("comment.createdAt", "DESC");
    }

    const skip = (page - 1) * limit;
    const [comments, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: comments.map((c) => this.sanitizeComment(c)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a comment with its replies
   */
  async findById(id: string): Promise<Comment> {
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: ["user", "replies", "replies.user"],
    });

    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    return this.sanitizeComment(comment) as Comment;
  }

  /**
   * Get comments for a story with threaded structure
   */
  async getThreadedComments(
    storyId: string,
    segmentId?: string,
    page = 1,
    rawLimit = 20,
  ) {
    // Cap limit to prevent resource exhaustion
    const limit = Math.min(Math.max(1, rawLimit), 50);
    const queryBuilder = this.commentRepository
      .createQueryBuilder("comment")
      .leftJoinAndSelect("comment.user", "user")
      .where("comment.storyId = :storyId", { storyId })
      .andWhere("comment.isDeleted = :isDeleted", { isDeleted: false })
      .andWhere("comment.parentCommentId IS NULL");

    if (segmentId) {
      queryBuilder.andWhere("comment.segmentId = :segmentId", { segmentId });
    } else {
      queryBuilder.andWhere("comment.segmentId IS NULL");
    }

    const skip = (page - 1) * limit;
    const [rootComments, total] = await queryBuilder
      .orderBy("comment.createdAt", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Batch-load replies for all root comments to avoid N+1 queries
    const rootCommentIds = rootComments.map((c) => c.id);
    let allReplies: Comment[] = [];
    if (rootCommentIds.length > 0) {
      allReplies = await this.commentRepository
        .createQueryBuilder("reply")
        .leftJoinAndSelect("reply.user", "user")
        .where("reply.parentCommentId IN (:...ids)", { ids: rootCommentIds })
        .andWhere("reply.isDeleted = :isDeleted", { isDeleted: false })
        .orderBy("reply.createdAt", "ASC")
        .getMany();
    }

    // Group replies by parent and take first 3
    const repliesByParent = new Map<string, Comment[]>();
    for (const reply of allReplies) {
      const existing = repliesByParent.get(reply.parentCommentId!) || [];
      if (existing.length < 3) {
        existing.push(reply);
      }
      repliesByParent.set(reply.parentCommentId!, existing);
    }

    const commentsWithReplies = rootComments.map((comment) => {
      const replies = repliesByParent.get(comment.id) || [];
      return {
        ...this.sanitizeComment(comment),
        replies: replies.map((r) => this.sanitizeComment(r)),
        hasMoreReplies: comment.repliesCount > 3,
      };
    });

    return {
      data: commentsWithReplies,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update a comment
   */
  async update(
    id: string,
    updateDto: UpdateCommentDto,
    userId: string,
  ): Promise<Comment> {
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: ["user"],
    });

    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException("You can only edit your own comments");
    }

    if (comment.isDeleted) {
      throw new BadRequestException("Cannot edit a deleted comment");
    }

    comment.content = updateDto.content;
    comment.contentHtml = this.processContent(updateDto.content);
    comment.isEdited = true;

    return this.commentRepository.save(comment);
  }

  /**
   * Soft delete a comment
   */
  async delete(id: string, userId: string, userRole: UserRole): Promise<void> {
    const comment = await this.commentRepository.findOne({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    // Only owner or moderators can delete
    const canDelete =
      comment.userId === userId ||
      userRole === UserRole.MODERATOR ||
      userRole === UserRole.ADMIN;

    if (!canDelete) {
      throw new ForbiddenException("You can only delete your own comments");
    }

    // Soft delete
    comment.isDeleted = true;
    comment.deletedAt = new Date();
    comment.content = "[deleted]";
    comment.contentHtml = "<p>[deleted]</p>";

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Comment).save(comment);

      // Decrement parent's reply count
      if (comment.parentCommentId) {
        await manager
          .getRepository(Comment)
          .decrement({ id: comment.parentCommentId }, "repliesCount", 1);
      }

      // Decrement story comment count
      await manager
        .getRepository(Story)
        .decrement({ id: comment.storyId }, "commentCount", 1);
    });
  }

  /**
   * Like a comment (prevents duplicate likes per user)
   */
  async likeComment(commentId: string, userId: string): Promise<void> {
    const existing = await this.commentLikeRepository.findOne({
      where: { commentId, userId },
    });

    if (existing) {
      throw new BadRequestException("You have already liked this comment");
    }

    await this.commentLikeRepository.save(
      this.commentLikeRepository.create({ commentId, userId }),
    );
    await this.commentRepository.increment({ id: commentId }, "likesCount", 1);
  }

  /**
   * Unlike a comment (only if previously liked)
   */
  async unlikeComment(commentId: string, userId: string): Promise<void> {
    const existing = await this.commentLikeRepository.findOne({
      where: { commentId, userId },
    });

    if (!existing) {
      throw new BadRequestException("You have not liked this comment");
    }

    await this.commentLikeRepository.remove(existing);
    await this.commentRepository.decrement({ id: commentId }, "likesCount", 1);
  }

  /**
   * Check if user has liked a comment
   */
  async hasUserLiked(commentId: string, userId: string): Promise<boolean> {
    const count = await this.commentLikeRepository.count({
      where: { commentId, userId },
    });
    return count > 0;
  }

  /**
   * Get comment count for a story
   */
  async getCommentCount(storyId: string): Promise<number> {
    return this.commentRepository.count({
      where: { storyId, isDeleted: false },
    });
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private processContent(markdown: string): string {
    // Convert markdown to HTML
    const rawHtml = marked.parse(markdown, { async: false }) as string;

    // Sanitize HTML
    return sanitizeHtml(rawHtml, {
      allowedTags: [
        "p",
        "br",
        "strong",
        "em",
        "u",
        "s",
        "a",
        "ul",
        "ol",
        "li",
        "blockquote",
        "code",
        "pre",
      ],
      allowedAttributes: {
        a: ["href", "target", "rel"],
      },
      transformTags: {
        a: (tagName, attribs) => ({
          tagName,
          attribs: {
            ...attribs,
            target: "_blank",
            rel: "noopener noreferrer",
          },
        }),
      },
    });
  }

  private sanitizeComment(
    comment: Comment,
  ): Partial<Comment> & { user?: Partial<User> } {
    const result: any = { ...comment };

    // Remove sensitive user data
    if (result.user) {
      result.user = {
        id: result.user.id,
        username: result.user.username,
        displayName: result.user.displayName,
        avatarUrl: result.user.avatarUrl,
        role: result.user.role,
      };
    }

    // Process replies if present
    if (result.replies) {
      result.replies = result.replies
        .filter((r: Comment) => !r.isDeleted)
        .map((r: Comment) => this.sanitizeComment(r));
    }

    return result;
  }
}
