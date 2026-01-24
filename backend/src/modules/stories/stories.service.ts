import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike, Not, IsNull, MoreThan } from 'typeorm';
import {
  StoryStatus,
  StoryCategory,
  StoryQueryParams,
  CreateStoryDto,
  UpdateStoryDto,
  UserRole,
} from '@aardvark/shared';
import { Story, StoryStateVariable, Rating } from '@/database/entities';

/**
 * Service handling story CRUD operations and queries.
 */
@Injectable()
export class StoriesService {
  constructor(
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(StoryStateVariable)
    private readonly stateVariableRepository: Repository<StoryStateVariable>,
    @InjectRepository(Rating)
    private readonly ratingRepository: Repository<Rating>,
  ) {}

  /**
   * Create a new story
   */
  async create(userId: string, createDto: CreateStoryDto): Promise<Story> {
    const story = this.storyRepository.create({
      ...createDto,
      authorId: userId,
      status: StoryStatus.DRAFT,
    });

    return this.storyRepository.save(story);
  }

  /**
   * Find all stories with filtering and pagination
   */
  async findAll(query: StoryQueryParams): Promise<{
    items: Story[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit: rawLimit = 20,
      category,
      tags,
      status,
      isPremium,
      authorId,
      minRating,
      search,
      sortBy = 'created',
      sortOrder = 'desc',
    } = query;

    // Cap limit to prevent resource exhaustion
    const limit = Math.min(Math.max(1, rawLimit), 100);

    const where: FindOptionsWhere<Story> = {};

    // Apply filters
    if (category) {
      where.category = Array.isArray(category) ? category[0] : category;
    }
    if (status) {
      where.status = status;
    } else {
      // Default to published stories
      where.status = StoryStatus.PUBLISHED;
    }
    if (isPremium !== undefined) {
      where.isPremium = isPremium;
    }
    if (authorId) {
      where.authorId = authorId;
    }

    // Build query
    const queryBuilder = this.storyRepository
      .createQueryBuilder('story')
      .where(where);

    // Search filter
    if (search) {
      queryBuilder.andWhere(
        '(story.title ILIKE :search OR story.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Tags filter
    if (tags && tags.length > 0) {
      queryBuilder.andWhere('story.tags && :tags', { tags });
    }

    // Rating filter
    if (minRating) {
      queryBuilder.andWhere('story.averageRating >= :minRating', { minRating });
    }

    // Sorting
    const sortColumn = this.getSortColumn(sortBy);
    queryBuilder.orderBy(`story.${sortColumn}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
    };
  }

  /**
   * Find featured stories (admin-featured first, then top-rated fallback)
   */
  async findFeatured(limit = 4): Promise<Story[]> {
    // First, get explicitly featured stories
    const featured = await this.storyRepository.find({
      where: {
        status: StoryStatus.PUBLISHED,
        featuredAt: Not(IsNull()),
      },
      order: { featuredAt: 'DESC' },
      take: limit,
      relations: ['author'],
    });

    if (featured.length >= limit) return featured;

    // Fill remaining slots with top-rated stories
    const remaining = limit - featured.length;
    const featuredIds = featured.map((s) => s.id);
    const topRated = await this.storyRepository
      .createQueryBuilder('story')
      .leftJoinAndSelect('story.author', 'author')
      .where('story.status = :status', { status: StoryStatus.PUBLISHED })
      .andWhere('story.ratingsCount >= :minRatings', { minRatings: 3 })
      .andWhere(featuredIds.length > 0 ? 'story.id NOT IN (:...ids)' : '1=1', { ids: featuredIds })
      .orderBy('story.averageRating', 'DESC')
      .addOrderBy('story.viewCount', 'DESC')
      .take(remaining)
      .getMany();

    return [...featured, ...topRated];
  }

  /**
   * Find trending stories (recency-weighted popularity)
   */
  async findTrending(limit = 6): Promise<Story[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Prefer recently published stories with high view counts
    const recent = await this.storyRepository.find({
      where: {
        status: StoryStatus.PUBLISHED,
        publishedAt: MoreThan(thirtyDaysAgo),
      },
      order: { viewCount: 'DESC' },
      take: limit,
      relations: ['author'],
    });

    if (recent.length >= limit) return recent;

    // Fill remaining with all-time popular stories
    const remaining = limit - recent.length;
    const recentIds = recent.map((s) => s.id);
    const popular = await this.storyRepository
      .createQueryBuilder('story')
      .leftJoinAndSelect('story.author', 'author')
      .where('story.status = :status', { status: StoryStatus.PUBLISHED })
      .andWhere(recentIds.length > 0 ? 'story.id NOT IN (:...ids)' : '1=1', { ids: recentIds })
      .orderBy('story.viewCount', 'DESC')
      .take(remaining)
      .getMany();

    return [...recent, ...popular];
  }

  /**
   * Find a story by ID
   */
  async findOne(id: string): Promise<Story> {
    const story = await this.storyRepository.findOne({
      where: { id },
      relations: ['author'],
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    return story;
  }

  /**
   * Update a story
   */
  async update(
    id: string,
    userId: string,
    userRole: UserRole,
    updateDto: UpdateStoryDto,
  ): Promise<Story> {
    const story = await this.findOne(id);

    // Check ownership (unless admin/moderator)
    if (
      story.authorId !== userId &&
      userRole !== UserRole.ADMIN &&
      userRole !== UserRole.MODERATOR
    ) {
      throw new ForbiddenException('You can only edit your own stories');
    }

    Object.assign(story, updateDto);

    return this.storyRepository.save(story);
  }

  /**
   * Delete a story
   */
  async remove(id: string, userId: string, userRole: UserRole): Promise<void> {
    const story = await this.findOne(id);

    // Check ownership (unless admin)
    if (story.authorId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only delete your own stories');
    }

    await this.storyRepository.remove(story);
  }

  /**
   * Publish a story
   */
  async publish(id: string, userId: string): Promise<Story> {
    const story = await this.findOne(id);

    if (story.authorId !== userId) {
      throw new ForbiddenException('You can only publish your own stories');
    }

    if (!story.rootSegmentId) {
      throw new ForbiddenException(
        'Story must have a root segment before publishing',
      );
    }

    story.status = StoryStatus.PUBLISHED;
    story.publishedAt = new Date();

    return this.storyRepository.save(story);
  }

  /**
   * Increment view count
   */
  async incrementViews(id: string): Promise<void> {
    await this.storyRepository.increment({ id }, 'viewCount', 1);
  }

  /**
   * Update story rating (called when a rating is added/updated)
   */
  async updateRating(id: string): Promise<void> {
    const result = await this.ratingRepository
      .createQueryBuilder('rating')
      .select('AVG(rating.rating)', 'avg')
      .addSelect('COUNT(rating.id)', 'count')
      .where('rating.storyId = :id', { id })
      .getRawOne();

    const averageRating = result?.avg ? parseFloat(result.avg) : 0;
    const ratingsCount = result?.count ? parseInt(result.count, 10) : 0;

    await this.storyRepository.update(id, {
      averageRating: Math.round(averageRating * 10) / 10,
      ratingsCount,
    });
  }

  /**
   * Get story IDs and update dates for sitemap generation
   */
  async getSitemapData(): Promise<Array<{ id: string; updatedAt: string }>> {
    const stories = await this.storyRepository.find({
      where: { status: StoryStatus.PUBLISHED },
      select: ['id', 'updatedAt'],
      order: { updatedAt: 'DESC' },
      take: 10000,
    });

    return stories.map((story) => ({
      id: story.id,
      updatedAt: story.updatedAt.toISOString(),
    }));
  }

  /**
   * Get sort column from sort parameter
   */
  private getSortColumn(sortBy: string): string {
    const sortMap: Record<string, string> = {
      created: 'createdAt',
      updated: 'updatedAt',
      rating: 'averageRating',
      views: 'viewCount',
      trending: 'viewCount', // For MVP, trending = views
    };
    return sortMap[sortBy] || 'createdAt';
  }
}
