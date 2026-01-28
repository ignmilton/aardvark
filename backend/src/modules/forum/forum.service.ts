import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import {
  ForumThread,
  ForumPost,
  ForumVote,
  UserReputation,
  ForumCategory,
} from '@/database/entities';
import { User } from '@/database/entities';
import { UserRole } from '@aardvark/shared';
import * as sanitizeHtml from 'sanitize-html';
import {
  CreateThreadDto,
  UpdateThreadDto,
  CreatePostDto,
  UpdatePostDto,
  VotePostDto,
  ThreadQueryDto,
  PostQueryDto,
} from './dto';

@Injectable()
export class ForumService {
  constructor(
    @InjectRepository(ForumThread)
    private readonly threadRepository: Repository<ForumThread>,
    @InjectRepository(ForumPost)
    private readonly postRepository: Repository<ForumPost>,
    @InjectRepository(ForumVote)
    private readonly voteRepository: Repository<ForumVote>,
    @InjectRepository(UserReputation)
    private readonly reputationRepository: Repository<UserReputation>,
  ) {}

  /**
   * Get all categories with thread/post counts
   */
  async getCategories() {
    const categories = Object.values(ForumCategory);

    const stats = await Promise.all(
      categories.map(async (category) => {
        const threadCount = await this.threadRepository.count({
          where: { category, isDeleted: false },
        });

        const threads = await this.threadRepository.find({
          where: { category, isDeleted: false },
          select: ['replyCount'],
        });

        const postCount = threads.reduce((sum, thread) => sum + thread.replyCount, 0);

        // Get latest thread
        const latestThread = await this.threadRepository.findOne({
          where: { category, isDeleted: false },
          order: { createdAt: 'DESC' },
          relations: ['author'],
          select: {
            id: true,
            title: true,
            createdAt: true,
            author: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        });

        return {
          category,
          threadCount,
          postCount,
          latestThread: latestThread ? {
            id: latestThread.id,
            title: latestThread.title,
            createdAt: latestThread.createdAt,
            author: latestThread.author,
          } : null,
        };
      }),
    );

    return stats;
  }

  /**
   * Get threads with pagination and filtering
   */
  async getThreads(query: ThreadQueryDto) {
    const {
      category,
      authorId,
      search,
      pinnedOnly,
      sortBy = 'recent',
      page = 1,
      limit: rawLimit = 20,
    } = query;
    // Cap limit to prevent resource exhaustion
    const limit = Math.min(Math.max(1, rawLimit), 50);

    const queryBuilder = this.threadRepository
      .createQueryBuilder('thread')
      .leftJoinAndSelect('thread.author', 'author')
      .leftJoinAndSelect('thread.lastReplyUser', 'lastReplyUser')
      .where('thread.isDeleted = :isDeleted', { isDeleted: false });

    if (category) {
      queryBuilder.andWhere('thread.category = :category', { category });
    }

    if (authorId) {
      queryBuilder.andWhere('thread.authorId = :authorId', { authorId });
    }

    if (search) {
      queryBuilder.andWhere(
        '(thread.title ILIKE :search OR thread.content ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (pinnedOnly) {
      queryBuilder.andWhere('thread.isPinned = :isPinned', { isPinned: true });
    }

    // Sorting
    switch (sortBy) {
      case 'oldest':
        queryBuilder.orderBy('thread.createdAt', 'ASC');
        break;
      case 'replies':
        queryBuilder.orderBy('thread.replyCount', 'DESC');
        break;
      case 'views':
        queryBuilder.orderBy('thread.viewCount', 'DESC');
        break;
      case 'recent':
      default:
        // Pinned threads first, then by last reply or creation date
        queryBuilder
          .orderBy('thread.isPinned', 'DESC')
          .addOrderBy('COALESCE(thread.lastReplyAt, thread.createdAt)', 'DESC');
    }

    const skip = (page - 1) * limit;
    const [threads, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: threads.map((t) => this.sanitizeThread(t)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single thread with its details
   */
  async getThread(threadId: string) {
    const thread = await this.threadRepository.findOne({
      where: { id: threadId, isDeleted: false },
      relations: ['author', 'lastReplyUser'],
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    // Increment view count
    await this.threadRepository.increment({ id: threadId }, 'viewCount', 1);

    return this.sanitizeThread(thread);
  }

  /**
   * Create a new thread
   */
  async createThread(userId: string, dto: CreateThreadDto) {
    const thread = this.threadRepository.create({
      authorId: userId,
      category: dto.category,
      title: dto.title,
      content: this.sanitizeContent(dto.content),
    });

    const savedThread = await this.threadRepository.save(thread);

    // Update user reputation
    await this.updateReputationStats(userId, { threadsCreated: 1 });

    // Load relations for response
    return this.threadRepository.findOne({
      where: { id: savedThread.id },
      relations: ['author'],
    });
  }

  /**
   * Update a thread (author only)
   */
  async updateThread(userId: string, threadId: string, dto: UpdateThreadDto) {
    const thread = await this.threadRepository.findOne({
      where: { id: threadId, isDeleted: false },
      relations: ['author'],
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    if (thread.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own threads');
    }

    if (thread.isLocked) {
      throw new BadRequestException('Cannot edit a locked thread');
    }

    if (dto.title !== undefined) {
      thread.title = dto.title;
    }
    if (dto.content !== undefined) {
      thread.content = this.sanitizeContent(dto.content);
    }
    if (dto.category !== undefined) {
      thread.category = dto.category;
    }

    return this.threadRepository.save(thread);
  }

  /**
   * Delete a thread (author or moderator)
   */
  async deleteThread(userId: string, threadId: string, userRole: UserRole) {
    const thread = await this.threadRepository.findOne({
      where: { id: threadId, isDeleted: false },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const canDelete =
      thread.authorId === userId ||
      userRole === UserRole.MODERATOR ||
      userRole === UserRole.ADMIN;

    if (!canDelete) {
      throw new ForbiddenException('You can only delete your own threads');
    }

    // Soft delete
    thread.isDeleted = true;
    await this.threadRepository.save(thread);

    // Update user reputation
    if (thread.authorId === userId) {
      await this.updateReputationStats(userId, { threadsCreated: -1 });
    }
  }

  /**
   * Lock a thread (moderators only)
   */
  async lockThread(threadId: string, moderatorId: string) {
    const thread = await this.threadRepository.findOne({
      where: { id: threadId, isDeleted: false },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    thread.isLocked = true;
    return this.threadRepository.save(thread);
  }

  /**
   * Pin or unpin a thread (moderators only)
   */
  async pinThread(threadId: string, moderatorId: string, isPinned: boolean) {
    const thread = await this.threadRepository.findOne({
      where: { id: threadId, isDeleted: false },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    thread.isPinned = isPinned;
    return this.threadRepository.save(thread);
  }

  /**
   * Get posts for a thread
   */
  async getPosts(threadId: string, query: PostQueryDto) {
    const { page = 1, limit: rawLimit = 20, sortBy = 'oldest' } = query;
    // Cap limit to prevent resource exhaustion
    const limit = Math.min(Math.max(1, rawLimit), 50);

    // Verify thread exists
    const thread = await this.threadRepository.findOne({
      where: { id: threadId, isDeleted: false },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const queryBuilder = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.replyTo', 'replyTo')
      .leftJoinAndSelect('replyTo.author', 'replyToAuthor')
      .where('post.threadId = :threadId', { threadId })
      .andWhere('post.isDeleted = :isDeleted', { isDeleted: false });

    // Sorting
    switch (sortBy) {
      case 'newest':
        queryBuilder.orderBy('post.createdAt', 'DESC');
        break;
      case 'votes':
        queryBuilder.orderBy('post.upvotes - post.downvotes', 'DESC');
        break;
      case 'oldest':
      default:
        queryBuilder.orderBy('post.createdAt', 'ASC');
    }

    const skip = (page - 1) * limit;
    const [posts, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: posts.map((p) => this.sanitizePost(p)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create a reply in a thread
   */
  async createPost(userId: string, threadId: string, dto: CreatePostDto) {
    const thread = await this.threadRepository.findOne({
      where: { id: threadId, isDeleted: false },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    if (thread.isLocked) {
      throw new BadRequestException('Cannot post in a locked thread');
    }

    // If replying to a post, verify it exists
    if (dto.replyToId) {
      const replyToPost = await this.postRepository.findOne({
        where: { id: dto.replyToId, threadId, isDeleted: false },
      });
      if (!replyToPost) {
        throw new NotFoundException('Post to reply to not found');
      }
    }

    const post = this.postRepository.create({
      threadId,
      authorId: userId,
      content: this.sanitizeContent(dto.content),
      replyToId: dto.replyToId || null,
    });

    const savedPost = await this.postRepository.save(post);

    // Update thread stats
    await this.threadRepository.update(
      { id: threadId },
      {
        replyCount: () => 'replyCount + 1',
        lastReplyAt: new Date(),
        lastReplyUserId: userId,
      },
    );

    // Update user reputation
    await this.updateReputationStats(userId, { postsCreated: 1 });

    // Load relations for response
    return this.postRepository.findOne({
      where: { id: savedPost.id },
      relations: ['author', 'replyTo', 'replyTo.author'],
    });
  }

  /**
   * Update a post
   */
  async updatePost(userId: string, postId: string, dto: UpdatePostDto) {
    const post = await this.postRepository.findOne({
      where: { id: postId, isDeleted: false },
      relations: ['author', 'thread'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own posts');
    }

    if (post.thread.isLocked) {
      throw new BadRequestException('Cannot edit posts in a locked thread');
    }

    post.content = this.sanitizeContent(dto.content);
    post.isEdited = true;

    return this.postRepository.save(post);
  }

  /**
   * Delete a post
   */
  async deletePost(userId: string, postId: string, userRole: UserRole) {
    const post = await this.postRepository.findOne({
      where: { id: postId, isDeleted: false },
      relations: ['thread'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const canDelete =
      post.authorId === userId ||
      userRole === UserRole.MODERATOR ||
      userRole === UserRole.ADMIN;

    if (!canDelete) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    // Soft delete
    post.isDeleted = true;
    post.content = '[deleted]';
    await this.postRepository.save(post);

    // Update thread reply count
    await this.threadRepository.decrement({ id: post.threadId }, 'replyCount', 1);

    // Update user reputation
    if (post.authorId === userId) {
      await this.updateReputationStats(userId, { postsCreated: -1 });
    }
  }

  /**
   * Vote on a post
   */
  async votePost(userId: string, postId: string, value: 1 | -1) {
    const post = await this.postRepository.findOne({
      where: { id: postId, isDeleted: false },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Check if user already voted
    const existingVote = await this.voteRepository.findOne({
      where: { postId, userId },
    });

    if (existingVote) {
      // If same vote, remove it (toggle off)
      if (existingVote.value === value) {
        await this.voteRepository.remove(existingVote);

        // Update post vote counts
        if (value === 1) {
          await this.postRepository.decrement({ id: postId }, 'upvotes', 1);
          await this.updateReputationStats(post.authorId, { upvotesReceived: -1 });
        } else {
          await this.postRepository.decrement({ id: postId }, 'downvotes', 1);
          await this.updateReputationStats(post.authorId, { downvotesReceived: -1 });
        }
      } else {
        // Change vote
        const oldValue = existingVote.value;
        existingVote.value = value;
        await this.voteRepository.save(existingVote);

        // Update post vote counts
        if (oldValue === 1) {
          await this.postRepository.decrement({ id: postId }, 'upvotes', 1);
          await this.updateReputationStats(post.authorId, { upvotesReceived: -1 });
        } else {
          await this.postRepository.decrement({ id: postId }, 'downvotes', 1);
          await this.updateReputationStats(post.authorId, { downvotesReceived: -1 });
        }

        if (value === 1) {
          await this.postRepository.increment({ id: postId }, 'upvotes', 1);
          await this.updateReputationStats(post.authorId, { upvotesReceived: 1 });
        } else {
          await this.postRepository.increment({ id: postId }, 'downvotes', 1);
          await this.updateReputationStats(post.authorId, { downvotesReceived: 1 });
        }
      }
    } else {
      // New vote
      const vote = this.voteRepository.create({
        postId,
        userId,
        value,
      });
      await this.voteRepository.save(vote);

      // Update post vote counts
      if (value === 1) {
        await this.postRepository.increment({ id: postId }, 'upvotes', 1);
        await this.updateReputationStats(post.authorId, { upvotesReceived: 1 });
      } else {
        await this.postRepository.increment({ id: postId }, 'downvotes', 1);
        await this.updateReputationStats(post.authorId, { downvotesReceived: 1 });
      }
    }

    // Return updated post
    return this.postRepository.findOne({
      where: { id: postId },
      relations: ['author'],
    });
  }

  /**
   * Get user's reputation
   */
  async getUserReputation(userId: string) {
    let reputation = await this.reputationRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!reputation) {
      // Create initial reputation record
      reputation = this.reputationRepository.create({
        userId,
        score: 0,
        threadsCreated: 0,
        postsCreated: 0,
        upvotesReceived: 0,
        downvotesReceived: 0,
        helpfulAnswers: 0,
      });
      reputation = await this.reputationRepository.save(reputation);
    }

    return reputation;
  }

  /**
   * Recalculate user's reputation score
   */
  async updateReputation(userId: string) {
    const reputation = await this.getUserReputation(userId);

    // Calculate score based on activity
    // Formula: (upvotes * 10) - (downvotes * 5) + (threads * 5) + (posts * 2) + (helpful answers * 50)
    const score =
      reputation.upvotesReceived * 10 -
      reputation.downvotesReceived * 5 +
      reputation.threadsCreated * 5 +
      reputation.postsCreated * 2 +
      reputation.helpfulAnswers * 50;

    reputation.score = Math.max(0, score); // Score can't be negative
    return this.reputationRepository.save(reputation);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async updateReputationStats(
    userId: string,
    changes: {
      threadsCreated?: number;
      postsCreated?: number;
      upvotesReceived?: number;
      downvotesReceived?: number;
      helpfulAnswers?: number;
    },
  ) {
    let reputation = await this.reputationRepository.findOne({
      where: { userId },
    });

    if (!reputation) {
      reputation = this.reputationRepository.create({
        userId,
        score: 0,
        threadsCreated: 0,
        postsCreated: 0,
        upvotesReceived: 0,
        downvotesReceived: 0,
        helpfulAnswers: 0,
      });
    }

    if (changes.threadsCreated !== undefined) {
      reputation.threadsCreated = Math.max(0, reputation.threadsCreated + changes.threadsCreated);
    }
    if (changes.postsCreated !== undefined) {
      reputation.postsCreated = Math.max(0, reputation.postsCreated + changes.postsCreated);
    }
    if (changes.upvotesReceived !== undefined) {
      reputation.upvotesReceived = Math.max(0, reputation.upvotesReceived + changes.upvotesReceived);
    }
    if (changes.downvotesReceived !== undefined) {
      reputation.downvotesReceived = Math.max(0, reputation.downvotesReceived + changes.downvotesReceived);
    }
    if (changes.helpfulAnswers !== undefined) {
      reputation.helpfulAnswers = Math.max(0, reputation.helpfulAnswers + changes.helpfulAnswers);
    }

    // Recalculate score
    reputation.score =
      reputation.upvotesReceived * 10 -
      reputation.downvotesReceived * 5 +
      reputation.threadsCreated * 5 +
      reputation.postsCreated * 2 +
      reputation.helpfulAnswers * 50;
    reputation.score = Math.max(0, reputation.score);

    await this.reputationRepository.save(reputation);
  }

  private sanitizeThread(thread: ForumThread): any {
    const result: any = { ...thread };

    if (result.author) {
      result.author = {
        id: result.author.id,
        username: result.author.username,
        displayName: result.author.displayName,
        avatarUrl: result.author.avatarUrl,
        role: result.author.role,
      };
    }

    if (result.lastReplyUser) {
      result.lastReplyUser = {
        id: result.lastReplyUser.id,
        username: result.lastReplyUser.username,
        displayName: result.lastReplyUser.displayName,
        avatarUrl: result.lastReplyUser.avatarUrl,
      };
    }

    return result;
  }

  private sanitizePost(post: ForumPost): any {
    const result: any = { ...post };

    if (result.author) {
      result.author = {
        id: result.author.id,
        username: result.author.username,
        displayName: result.author.displayName,
        avatarUrl: result.author.avatarUrl,
        role: result.author.role,
      };
    }

    if (result.replyTo) {
      result.replyTo = {
        id: result.replyTo.id,
        content: result.replyTo.isDeleted ? '[deleted]' : result.replyTo.content.substring(0, 100),
        author: result.replyTo.author ? {
          id: result.replyTo.author.id,
          username: result.replyTo.author.username,
          displayName: result.replyTo.author.displayName,
        } : null,
      };
    }

    return result;
  }

  /**
   * Sanitize HTML content to prevent XSS attacks.
   * Allows basic formatting while stripping dangerous elements.
   */
  private sanitizeContent(html: string): string {
    return sanitizeHtml(html, {
      allowedTags: [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'blockquote', 'pre', 'code',
        'a',
      ],
      allowedAttributes: {
        a: ['href', 'target', 'rel', 'title'],
        pre: ['class'],
        code: ['class'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      transformTags: {
        a: (tagName, attribs) => ({
          tagName,
          attribs: {
            ...attribs,
            target: '_blank',
            rel: 'noopener noreferrer',
          },
        }),
      },
      disallowedTagsMode: 'discard',
    });
  }
}
