import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Collection,
  CollectionStory,
  CollectionFollower,
  Story,
} from "@/database/entities";
import {
  CreateCollectionDto,
  UpdateCollectionDto,
  AddStoryToCollectionDto,
  CollectionQueryDto,
} from "./dto";

@Injectable()
export class CollectionsService {
  constructor(
    @InjectRepository(Collection)
    private readonly collectionRepo: Repository<Collection>,
    @InjectRepository(CollectionStory)
    private readonly collectionStoryRepo: Repository<CollectionStory>,
    @InjectRepository(CollectionFollower)
    private readonly followerRepo: Repository<CollectionFollower>,
    @InjectRepository(Story)
    private readonly storyRepo: Repository<Story>,
  ) {}

  /**
   * Create a new collection
   */
  async create(userId: string, dto: CreateCollectionDto): Promise<Collection> {
    // Generate slug from name
    const slug = this.generateSlug(dto.name);

    // Check for slug uniqueness
    const existing = await this.collectionRepo.findOne({ where: { slug } });
    if (existing) {
      // Append random suffix if slug exists
      const uniqueSlug = `${slug}-${Date.now().toString(36)}`;
      const collection = this.collectionRepo.create({
        ...dto,
        slug: uniqueSlug,
        ownerId: userId,
      });
      return this.collectionRepo.save(collection);
    }

    const collection = this.collectionRepo.create({
      ...dto,
      slug,
      ownerId: userId,
    });

    return this.collectionRepo.save(collection);
  }

  /**
   * Find all public collections with pagination and filtering
   */
  async findAll(query: CollectionQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const qb = this.collectionRepo
      .createQueryBuilder("collection")
      .leftJoinAndSelect("collection.owner", "owner")
      .where("collection.isPublic = :isPublic", { isPublic: true });

    if (search) {
      qb.andWhere(
        "(collection.name ILIKE :search OR collection.description ILIKE :search)",
        { search: `%${search}%` },
      );
    }

    // SECURITY: Whitelist allowed sort columns to prevent SQL injection
    const allowedSortColumns: Record<string, string> = {
      createdAt: "collection.createdAt",
      updatedAt: "collection.updatedAt",
      name: "collection.name",
      followerCount: "collection.followerCount",
    };
    const sortColumn = allowedSortColumns[sortBy] || "collection.createdAt";
    const sortDirection = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";
    qb.orderBy(sortColumn, sortDirection);

    const [collections, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: collections,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find collection by ID
   */
  async findOne(id: string, requesterId?: string): Promise<Collection> {
    const collection = await this.collectionRepo.findOne({
      where: { id },
      relations: ["owner", "collectionStories", "collectionStories.story"],
    });

    if (!collection) {
      throw new NotFoundException("Collection not found");
    }

    // Check visibility
    if (!collection.isPublic && collection.ownerId !== requesterId) {
      throw new ForbiddenException("This collection is private");
    }

    return collection;
  }

  /**
   * Find collection by slug
   */
  async findBySlug(slug: string, requesterId?: string): Promise<Collection> {
    const collection = await this.collectionRepo.findOne({
      where: { slug },
      relations: ["owner", "collectionStories", "collectionStories.story"],
    });

    if (!collection) {
      throw new NotFoundException("Collection not found");
    }

    if (!collection.isPublic && collection.ownerId !== requesterId) {
      throw new ForbiddenException("This collection is private");
    }

    return collection;
  }

  /**
   * Get collections for a specific user
   */
  async findByUser(userId: string, requesterId?: string) {
    const qb = this.collectionRepo
      .createQueryBuilder("collection")
      .leftJoinAndSelect("collection.owner", "owner")
      .where("collection.ownerId = :userId", { userId });

    // If not the owner, only show public collections
    if (userId !== requesterId) {
      qb.andWhere("collection.isPublic = :isPublic", { isPublic: true });
    }

    return qb.orderBy("collection.createdAt", "DESC").getMany();
  }

  /**
   * Get current user's collections
   */
  async findMine(userId: string) {
    return this.collectionRepo.find({
      where: { ownerId: userId },
      relations: ["collectionStories"],
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Update a collection
   */
  async update(
    id: string,
    userId: string,
    dto: UpdateCollectionDto,
  ): Promise<Collection> {
    const collection = await this.collectionRepo.findOne({ where: { id } });

    if (!collection) {
      throw new NotFoundException("Collection not found");
    }

    if (collection.ownerId !== userId) {
      throw new ForbiddenException("You can only update your own collections");
    }

    // If name is being updated, update slug too
    if (dto.name && dto.name !== collection.name) {
      const newSlug = this.generateSlug(dto.name);
      const existing = await this.collectionRepo.findOne({
        where: { slug: newSlug },
      });
      collection.slug = existing
        ? `${newSlug}-${Date.now().toString(36)}`
        : newSlug;
    }

    Object.assign(collection, dto);
    return this.collectionRepo.save(collection);
  }

  /**
   * Delete a collection
   */
  async delete(id: string, userId: string): Promise<void> {
    const collection = await this.collectionRepo.findOne({ where: { id } });

    if (!collection) {
      throw new NotFoundException("Collection not found");
    }

    if (collection.ownerId !== userId) {
      throw new ForbiddenException("You can only delete your own collections");
    }

    await this.collectionRepo.remove(collection);
  }

  /**
   * Add a story to a collection
   */
  async addStory(
    collectionId: string,
    userId: string,
    dto: AddStoryToCollectionDto,
  ) {
    const collection = await this.collectionRepo.findOne({
      where: { id: collectionId },
      relations: ["collectionStories"],
    });

    if (!collection) {
      throw new NotFoundException("Collection not found");
    }

    if (collection.ownerId !== userId) {
      throw new ForbiddenException(
        "You can only add stories to your own collections",
      );
    }

    // Check if story exists
    const story = await this.storyRepo.findOne({ where: { id: dto.storyId } });
    if (!story) {
      throw new NotFoundException("Story not found");
    }

    // Check if story is already in collection
    const existing = await this.collectionStoryRepo.findOne({
      where: { collectionId, storyId: dto.storyId },
    });

    if (existing) {
      throw new ConflictException("Story is already in this collection");
    }

    // Get max order
    const maxOrder = collection.collectionStories.reduce(
      (max, cs) => Math.max(max, cs.order),
      0,
    );

    const collectionStory = this.collectionStoryRepo.create({
      collectionId,
      storyId: dto.storyId,
      curatorNote: dto.curatorNote,
      order: maxOrder + 1,
    });

    await this.collectionStoryRepo.save(collectionStory);

    return this.findOne(collectionId, userId);
  }

  /**
   * Remove a story from a collection
   */
  async removeStory(
    collectionId: string,
    storyId: string,
    userId: string,
  ): Promise<void> {
    const collection = await this.collectionRepo.findOne({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new NotFoundException("Collection not found");
    }

    if (collection.ownerId !== userId) {
      throw new ForbiddenException(
        "You can only remove stories from your own collections",
      );
    }

    const collectionStory = await this.collectionStoryRepo.findOne({
      where: { collectionId, storyId },
    });

    if (!collectionStory) {
      throw new NotFoundException("Story not found in collection");
    }

    await this.collectionStoryRepo.remove(collectionStory);
  }

  /**
   * Reorder stories in a collection
   */
  async reorderStories(
    collectionId: string,
    userId: string,
    storyIds: string[],
  ) {
    const collection = await this.collectionRepo.findOne({
      where: { id: collectionId },
      relations: ["collectionStories"],
    });

    if (!collection) {
      throw new NotFoundException("Collection not found");
    }

    if (collection.ownerId !== userId) {
      throw new ForbiddenException("You can only reorder your own collections");
    }

    // Update order for each story
    for (let i = 0; i < storyIds.length; i++) {
      await this.collectionStoryRepo.update(
        { collectionId, storyId: storyIds[i] },
        { order: i + 1 },
      );
    }

    return this.findOne(collectionId, userId);
  }

  /**
   * Follow a collection
   */
  async follow(collectionId: string, userId: string) {
    const collection = await this.collectionRepo.findOne({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new NotFoundException("Collection not found");
    }

    if (!collection.isPublic) {
      throw new ForbiddenException("Cannot follow a private collection");
    }

    if (collection.ownerId === userId) {
      throw new ConflictException("Cannot follow your own collection");
    }

    // Check if already following
    const existing = await this.followerRepo.findOne({
      where: { collectionId, userId },
    });

    if (existing) {
      throw new ConflictException("Already following this collection");
    }

    const follower = this.followerRepo.create({ collectionId, userId });
    await this.followerRepo.save(follower);

    // Increment follower count
    await this.collectionRepo.increment(
      { id: collectionId },
      "followerCount",
      1,
    );

    return { success: true, message: "Now following collection" };
  }

  /**
   * Unfollow a collection
   */
  async unfollow(collectionId: string, userId: string): Promise<void> {
    const follower = await this.followerRepo.findOne({
      where: { collectionId, userId },
    });

    if (!follower) {
      throw new NotFoundException("Not following this collection");
    }

    await this.followerRepo.remove(follower);

    // Decrement follower count
    await this.collectionRepo.decrement(
      { id: collectionId },
      "followerCount",
      1,
    );
  }

  /**
   * Check if user is following a collection
   */
  async isFollowing(collectionId: string, userId: string): Promise<boolean> {
    const follower = await this.followerRepo.findOne({
      where: { collectionId, userId },
    });
    return !!follower;
  }

  /**
   * Get collections followed by a user
   */
  async getFollowedCollections(userId: string) {
    const followers = await this.followerRepo.find({
      where: { userId },
      relations: ["collection", "collection.owner"],
      order: { followedAt: "DESC" },
    });

    return followers.map((f) => f.collection);
  }

  /**
   * Generate URL-friendly slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100);
  }
}
