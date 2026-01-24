import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import {
  Story,
  ReaderProgress,
  Rating,
  User,
} from '@/database/entities';
import { StoryStatus, StoryCategory } from '@aardvark/shared';

/**
 * Recommendation result interface
 */
export interface RecommendedStory {
  story: Story;
  score: number;
  reason: 'similar_readers' | 'similar_content' | 'popular' | 'trending' | 'author_follow';
}

/**
 * Recommendation Service
 * Provides personalized story recommendations using hybrid filtering
 * (collaborative + content-based)
 */
@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(ReaderProgress)
    private readonly progressRepository: Repository<ReaderProgress>,
    @InjectRepository(Rating)
    private readonly ratingRepository: Repository<Rating>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Get personalized recommendations for a user
   * Uses hybrid approach: collaborative + content-based filtering
   */
  async getRecommendations(
    userId: string,
    limit: number = 10,
  ): Promise<RecommendedStory[]> {
    const recommendations: RecommendedStory[] = [];

    // Get user's reading history and preferences using query builder
    // to avoid N+1 queries and select only needed fields
    const userProgress = await this.progressRepository
      .createQueryBuilder('progress')
      .leftJoinAndSelect('progress.story', 'story')
      .where('progress.userId = :userId', { userId })
      .orderBy('progress.lastReadAt', 'DESC')
      .take(50)
      .getMany();

    const userRatings = await this.ratingRepository
      .createQueryBuilder('rating')
      .leftJoinAndSelect('rating.story', 'story')
      .where('rating.userId = :userId', { userId })
      .getMany();

    // Get IDs of stories user has already read
    const readStoryIds = new Set(userProgress.map((p) => p.storyId));
    const ratedStoryIds = new Set(userRatings.map((r) => r.storyId));
    const excludeIds = [...new Set([...readStoryIds, ...ratedStoryIds])];

    // 1. Collaborative filtering - find stories liked by similar readers
    const collaborativeRecs = await this.getCollaborativeRecommendations(
      userId,
      excludeIds,
      Math.ceil(limit * 0.4),
    );
    recommendations.push(...collaborativeRecs);

    // 2. Content-based filtering - find stories similar to user's favorites
    const contentBasedRecs = await this.getContentBasedRecommendations(
      userId,
      userProgress,
      userRatings,
      [...excludeIds, ...collaborativeRecs.map((r) => r.story.id)],
      Math.ceil(limit * 0.4),
    );
    recommendations.push(...contentBasedRecs);

    // 3. Fill remaining with trending/popular stories
    const currentIds = recommendations.map((r) => r.story.id);
    const trendingRecs = await this.getTrendingStories(
      [...excludeIds, ...currentIds],
      limit - recommendations.length,
    );
    recommendations.push(...trendingRecs);

    // Sort by score and return top results
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Collaborative filtering: Find stories liked by users with similar taste
   */
  private async getCollaborativeRecommendations(
    userId: string,
    excludeIds: string[],
    limit: number,
  ): Promise<RecommendedStory[]> {
    try {
      // Find users who rated the same stories highly
      const userHighRatings = await this.ratingRepository.find({
        where: { userId, rating: 4 }, // 4+ stars
        select: ['storyId'],
      });

      if (userHighRatings.length === 0) {
        return [];
      }

      const likedStoryIds = userHighRatings.map((r) => r.storyId);

      // Find other users who also rated these stories highly
      const similarUsers = await this.ratingRepository
        .createQueryBuilder('rating')
        .select('rating.userId')
        .where('rating.storyId IN (:...storyIds)', { storyIds: likedStoryIds })
        .andWhere('rating.userId != :userId', { userId })
        .andWhere('rating.rating >= 4')
        .groupBy('rating.userId')
        .having('COUNT(*) >= 2')
        .limit(20)
        .getRawMany();

      if (similarUsers.length === 0) {
        return [];
      }

      const similarUserIds = similarUsers.map((u) => u.rating_userId);

      // Find stories these similar users rated highly
      const queryBuilder = this.ratingRepository
        .createQueryBuilder('rating')
        .select('rating.storyId', 'storyId')
        .addSelect('AVG(rating.rating)', 'avgRating')
        .addSelect('COUNT(*)', 'ratingCount')
        .innerJoin('rating.story', 'story')
        .where('rating.userId IN (:...userIds)', { userIds: similarUserIds })
        .andWhere('rating.rating >= 4')
        .andWhere('story.status = :status', { status: StoryStatus.PUBLISHED });

      if (excludeIds.length > 0) {
        queryBuilder.andWhere('rating.storyId NOT IN (:...excludeIds)', { excludeIds });
      }

      const recommendations = await queryBuilder
        .groupBy('rating.storyId')
        .orderBy('avgRating', 'DESC')
        .addOrderBy('ratingCount', 'DESC')
        .limit(limit)
        .getRawMany();

      // Fetch full story objects
      const storyIds = recommendations.map((r) => r.storyId);
      if (storyIds.length === 0) return [];

      const stories = await this.storyRepository.find({
        where: { id: In(storyIds) },
        relations: ['author'],
      });

      const storyMap = new Map(stories.map((s) => [s.id, s]));

      return recommendations
        .filter((r) => storyMap.has(r.storyId))
        .map((r) => ({
          story: storyMap.get(r.storyId)!,
          score: parseFloat(r.avgRating) * 0.8 + Math.min(parseInt(r.ratingCount) / 10, 1) * 0.2,
          reason: 'similar_readers' as const,
        }));
    } catch (error) {
      this.logger.error(`Collaborative filtering error: ${error.message}`);
      return [];
    }
  }

  /**
   * Content-based filtering: Find stories similar to user's preferences
   */
  private async getContentBasedRecommendations(
    userId: string,
    userProgress: ReaderProgress[],
    userRatings: Rating[],
    excludeIds: string[],
    limit: number,
  ): Promise<RecommendedStory[]> {
    try {
      // Analyze user's preferred categories and tags
      const categoryPreferences = new Map<StoryCategory, number>();
      const tagPreferences = new Map<string, number>();

      // Weight by ratings (higher rated = stronger preference)
      for (const rating of userRatings) {
        if (rating.story) {
          const weight = rating.rating / 5;
          const currentCatWeight = categoryPreferences.get(rating.story.category) || 0;
          categoryPreferences.set(rating.story.category, currentCatWeight + weight);

          for (const tag of rating.story.tags || []) {
            const currentTagWeight = tagPreferences.get(tag) || 0;
            tagPreferences.set(tag, currentTagWeight + weight);
          }
        }
      }

      // Also consider reading progress
      for (const progress of userProgress) {
        if (progress.story) {
          const weight = 0.5; // Lower weight than explicit ratings
          const currentCatWeight = categoryPreferences.get(progress.story.category) || 0;
          categoryPreferences.set(progress.story.category, currentCatWeight + weight);

          for (const tag of progress.story.tags || []) {
            const currentTagWeight = tagPreferences.get(tag) || 0;
            tagPreferences.set(tag, currentTagWeight + weight);
          }
        }
      }

      // Get top preferred categories
      const topCategories = [...categoryPreferences.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat]) => cat);

      // Get top preferred tags
      const topTags = [...tagPreferences.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag]) => tag);

      if (topCategories.length === 0) {
        return [];
      }

      // Find stories matching preferences
      const queryBuilder = this.storyRepository
        .createQueryBuilder('story')
        .leftJoinAndSelect('story.author', 'author')
        .where('story.status = :status', { status: StoryStatus.PUBLISHED })
        .andWhere('story.category IN (:...categories)', { categories: topCategories });

      if (excludeIds.length > 0) {
        queryBuilder.andWhere('story.id NOT IN (:...excludeIds)', { excludeIds });
      }

      // Prefer stories with matching tags
      if (topTags.length > 0) {
        queryBuilder.addSelect(
          `(SELECT COUNT(*) FROM unnest(story.tags) tag WHERE tag = ANY(:topTags))`,
          'tagMatchCount',
        );
        queryBuilder.setParameter('topTags', topTags);
        queryBuilder.orderBy('tagMatchCount', 'DESC');
      }

      queryBuilder
        .addOrderBy('story.viewCount', 'DESC')
        .addOrderBy('story.averageRating', 'DESC')
        .limit(limit);

      const stories = await queryBuilder.getMany();

      return stories.map((story, index) => ({
        story,
        score: 0.9 - index * 0.05, // Decreasing score based on ranking
        reason: 'similar_content' as const,
      }));
    } catch (error) {
      this.logger.error(`Content-based filtering error: ${error.message}`);
      return [];
    }
  }

  /**
   * Get trending stories (last 7 days)
   */
  private async getTrendingStories(
    excludeIds: string[],
    limit: number,
  ): Promise<RecommendedStory[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const queryBuilder = this.storyRepository
      .createQueryBuilder('story')
      .leftJoinAndSelect('story.author', 'author')
      .where('story.status = :status', { status: StoryStatus.PUBLISHED })
      .andWhere('story.updatedAt >= :sevenDaysAgo', { sevenDaysAgo });

    if (excludeIds.length > 0) {
      queryBuilder.andWhere('story.id NOT IN (:...excludeIds)', { excludeIds });
    }

    const stories = await queryBuilder
      .orderBy('story.viewCount', 'DESC')
      .addOrderBy('story.averageRating', 'DESC')
      .limit(limit)
      .getMany();

    return stories.map((story, index) => ({
      story,
      score: 0.7 - index * 0.05,
      reason: 'trending' as const,
    }));
  }

  /**
   * Get popular stories (all time)
   */
  async getPopularStories(limit: number = 10): Promise<Story[]> {
    return this.storyRepository.find({
      where: { status: StoryStatus.PUBLISHED },
      relations: ['author'],
      order: {
        viewCount: 'DESC',
        averageRating: 'DESC',
      },
      take: limit,
    });
  }

  /**
   * Get stories by followed authors
   */
  async getStoriesFromFollowedAuthors(
    userId: string,
    limit: number = 10,
  ): Promise<RecommendedStory[]> {
    // Get followed author IDs from the follow table
    const follows = await this.userRepository.manager
      .getRepository('Follow')
      .find({
        where: { followerId: userId },
        select: ['followingId'],
      });

    if (!follows || follows.length === 0) {
      return [];
    }

    const followedAuthorIds = follows.map((f: any) => f.followingId);

    const stories = await this.storyRepository.find({
      where: {
        authorId: In(followedAuthorIds),
        status: StoryStatus.PUBLISHED,
      },
      relations: ['author'],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return stories.map((story, index) => ({
      story,
      score: 1.0 - index * 0.05,
      reason: 'author_follow' as const,
    }));
  }

  /**
   * Get similar stories to a given story
   */
  async getSimilarStories(storyId: string, limit: number = 5): Promise<Story[]> {
    const story = await this.storyRepository.findOne({
      where: { id: storyId },
    });

    if (!story) {
      return [];
    }

    // Find stories with same category and overlapping tags
    const queryBuilder = this.storyRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.author', 'author')
      .where('s.status = :status', { status: StoryStatus.PUBLISHED })
      .andWhere('s.id != :storyId', { storyId })
      .andWhere('s.category = :category', { category: story.category });

    if (story.tags && story.tags.length > 0) {
      queryBuilder.addSelect(
        `(SELECT COUNT(*) FROM unnest(s.tags) tag WHERE tag = ANY(:tags))`,
        'tagMatchCount',
      );
      queryBuilder.setParameter('tags', story.tags);
      queryBuilder.orderBy('tagMatchCount', 'DESC');
    }

    queryBuilder
      .addOrderBy('s.averageRating', 'DESC')
      .addOrderBy('s.viewCount', 'DESC')
      .limit(limit);

    return queryBuilder.getMany();
  }

  /**
   * Record user interaction for real-time recommendation updates
   */
  async recordInteraction(
    userId: string,
    storyId: string,
    interactionType: 'view' | 'read' | 'rate' | 'bookmark',
  ): Promise<void> {
    // This could be expanded to update user preference vectors in real-time
    // For now, we rely on the existing ReaderProgress and Rating tables
    this.logger.log(
      `Recorded ${interactionType} interaction: user=${userId}, story=${storyId}`,
    );
  }
}
