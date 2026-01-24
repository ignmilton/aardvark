import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { User, Follow } from '@/database/entities';
import { UpdateUserDto, UserQueryDto } from './dto';
import { UserRole, UserProfile, UserStats } from '@aardvark/shared';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
  ) {}

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { username } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  /**
   * Get public user profile
   */
  async getProfile(username: string, currentUserId?: string): Promise<UserProfile & { isFollowing?: boolean }> {
    const user = await this.userRepository.findOne({
      where: { username },
      relations: ['stories', 'ratings'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const stats = await this.getUserStats(user.id);

    let isFollowing: boolean | undefined;
    if (currentUserId && currentUserId !== user.id) {
      const follow = await this.followRepository.findOne({
        where: { followerId: currentUserId, followingId: user.id },
      });
      isFollowing = !!follow;
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      websiteUrl: user.websiteUrl,
      socialLinks: user.socialLinks,
      role: user.role,
      isPremium: user.isPremium,
      createdAt: user.createdAt,
      stats,
      badges: [], // TODO: Implement badges system
      isFollowing,
    };
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<UserStats> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['stories', 'comments', 'segments'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get follower counts
    const [followersCount, followingCount] = await Promise.all([
      this.followRepository.count({ where: { followingId: userId } }),
      this.followRepository.count({ where: { followerId: userId } }),
    ]);

    // Calculate total reads and ratings from stories
    const publishedStories = user.stories?.filter((s) => s.publishedAt != null) || [];
    const totalReads = publishedStories.reduce((sum, s) => sum + s.viewCount, 0);
    const totalRatings = publishedStories.reduce((sum, s) => sum + s.ratingsCount, 0);
    const averageRating =
      totalRatings > 0
        ? publishedStories.reduce((sum, s) => sum + s.averageRating * s.ratingsCount, 0) / totalRatings
        : 0;

    return {
      storiesPublished: publishedStories.length,
      storiesRead: 0, // TODO: Calculate from reader progress
      totalReads,
      totalRatings,
      averageRating: Math.round(averageRating * 10) / 10,
      followersCount,
      followingCount,
      commentsCount: user.comments?.length || 0,
      contributedBranches: user.segments?.filter((s) => s.storyId !== s.author?.id).length || 0,
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updateDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(userId);

    // Merge preferences if provided
    if (updateDto.preferences) {
      user.preferences = {
        ...user.preferences,
        ...updateDto.preferences,
      };
      delete updateDto.preferences;
    }

    Object.assign(user, updateDto);
    return this.userRepository.save(user);
  }

  /**
   * Update user avatar
   */
  async updateAvatar(userId: string, avatarUrl: string): Promise<User> {
    const user = await this.findById(userId);
    user.avatarUrl = avatarUrl;
    return this.userRepository.save(user);
  }

  /**
   * Search users with pagination
   */
  async searchUsers(query: UserQueryDto) {
    const { search, role, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    // Search filter
    if (search) {
      queryBuilder.andWhere(
        '(user.username ILIKE :search OR user.displayName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Role filter
    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    // Only active users
    queryBuilder.andWhere('user.accountStatus = :status', { status: 'active' });

    // Sorting
    if (sortBy === 'followersCount') {
      // Subquery for follower count
      queryBuilder
        .addSelect(
          (subQuery) =>
            subQuery
              .select('COUNT(f.id)')
              .from(Follow, 'f')
              .where('f.followingId = user.id'),
          'followerCount',
        )
        .orderBy('followerCount', sortOrder.toUpperCase() as 'ASC' | 'DESC');
    } else {
      queryBuilder.orderBy(`user.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');
    }

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      data: users.map((u) => this.sanitizeUser(u)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Follow a user
   */
  async followUser(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) {
      throw new ForbiddenException('You cannot follow yourself');
    }

    // Check if target user exists
    const targetUser = await this.userRepository.findOne({ where: { id: followingId } });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Check if already following
    const existingFollow = await this.followRepository.findOne({
      where: { followerId, followingId },
    });

    if (existingFollow) {
      throw new ConflictException('Already following this user');
    }

    const follow = this.followRepository.create({ followerId, followingId });
    await this.followRepository.save(follow);
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const follow = await this.followRepository.findOne({
      where: { followerId, followingId },
    });

    if (!follow) {
      throw new NotFoundException('Not following this user');
    }

    await this.followRepository.remove(follow);
  }

  /**
   * Get followers of a user
   */
  async getFollowers(userId: string, page = 1, limit = 20) {
    const [follows, total] = await this.followRepository.findAndCount({
      where: { followingId: userId },
      relations: ['follower'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: follows.map((f) => this.sanitizeUser(f.follower)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get users that a user is following
   */
  async getFollowing(userId: string, page = 1, limit = 20) {
    const [follows, total] = await this.followRepository.findAndCount({
      where: { followerId: userId },
      relations: ['following'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: follows.map((f) => this.sanitizeUser(f.following)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Check if user is following another user
   */
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.followRepository.findOne({
      where: { followerId, followingId },
    });
    return !!follow;
  }

  /**
   * Upgrade user to author role
   */
  async upgradeToAuthor(userId: string): Promise<User> {
    const user = await this.findById(userId);

    if (user.role === UserRole.AUTHOR || user.role === UserRole.MODERATOR || user.role === UserRole.ADMIN) {
      throw new ConflictException('User already has author privileges');
    }

    user.role = UserRole.AUTHOR;
    return this.userRepository.save(user);
  }

  /**
   * Remove sensitive fields from user object
   */
  private sanitizeUser(user: User): Partial<User> {
    const { passwordHash, emailVerificationToken, passwordResetToken, twoFactorSecret, ...sanitized } = user as any;
    return sanitized;
  }
}
