import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  ReadingList,
  ReadingListFollow,
  Story,
  User,
} from "@/database/entities";

@Injectable()
export class ReadingListsService {
  constructor(
    @InjectRepository(ReadingList)
    private readingListRepository: Repository<ReadingList>,
    @InjectRepository(ReadingListFollow)
    private readingListFollowRepository: Repository<ReadingListFollow>,
    @InjectRepository(Story)
    private storyRepository: Repository<Story>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Create a new reading list
   */
  async create(
    userId: string,
    data: {
      name: string;
      description?: string;
      isPublic?: boolean;
      coverImageUrl?: string;
    },
  ): Promise<ReadingList> {
    const readingList = this.readingListRepository.create({
      userId,
      name: data.name,
      description: data.description || null,
      isPublic: data.isPublic ?? false,
      coverImageUrl: data.coverImageUrl || null,
      storyCount: 0,
      followersCount: 0,
    });

    return this.readingListRepository.save(readingList);
  }

  /**
   * Get user's reading lists
   */
  async getUserLists(
    userId: string,
    requesterId?: string,
  ): Promise<ReadingList[]> {
    const where: any = { userId };

    // If requester is not the owner, only show public lists
    if (requesterId !== userId) {
      where.isPublic = true;
    }

    return this.readingListRepository.find({
      where,
      relations: ["user"],
      order: { updatedAt: "DESC" },
    });
  }

  /**
   * Get a single reading list by ID
   */
  async getById(listId: string, requesterId?: string): Promise<ReadingList> {
    const readingList = await this.readingListRepository.findOne({
      where: { id: listId },
      relations: ["user", "stories", "stories.author"],
    });

    if (!readingList) {
      throw new NotFoundException("Reading list not found");
    }

    // Check access permissions
    if (!readingList.isPublic && readingList.userId !== requesterId) {
      throw new ForbiddenException("This reading list is private");
    }

    return readingList;
  }

  /**
   * Update a reading list
   */
  async update(
    listId: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
      isPublic?: boolean;
      coverImageUrl?: string;
    },
  ): Promise<ReadingList> {
    const readingList = await this.readingListRepository.findOne({
      where: { id: listId },
    });

    if (!readingList) {
      throw new NotFoundException("Reading list not found");
    }

    if (readingList.userId !== userId) {
      throw new ForbiddenException(
        "You can only update your own reading lists",
      );
    }

    Object.assign(readingList, {
      ...data,
      updatedAt: new Date(),
    });

    return this.readingListRepository.save(readingList);
  }

  /**
   * Delete a reading list
   */
  async delete(listId: string, userId: string): Promise<void> {
    const readingList = await this.readingListRepository.findOne({
      where: { id: listId },
    });

    if (!readingList) {
      throw new NotFoundException("Reading list not found");
    }

    if (readingList.userId !== userId) {
      throw new ForbiddenException(
        "You can only delete your own reading lists",
      );
    }

    await this.readingListRepository.remove(readingList);
  }

  /**
   * Add a story to a reading list
   */
  async addStory(
    listId: string,
    storyId: string,
    userId: string,
  ): Promise<ReadingList> {
    const readingList = await this.readingListRepository.findOne({
      where: { id: listId },
      relations: ["stories"],
    });

    if (!readingList) {
      throw new NotFoundException("Reading list not found");
    }

    if (readingList.userId !== userId) {
      throw new ForbiddenException(
        "You can only modify your own reading lists",
      );
    }

    const story = await this.storyRepository.findOne({
      where: { id: storyId },
    });

    if (!story) {
      throw new NotFoundException("Story not found");
    }

    // Check if story already exists in list
    const existingStory = readingList.stories?.find((s) => s.id === storyId);
    if (existingStory) {
      throw new BadRequestException("Story is already in this reading list");
    }

    readingList.stories = [...(readingList.stories || []), story];
    readingList.storyCount = readingList.stories.length;

    return this.readingListRepository.save(readingList);
  }

  /**
   * Remove a story from a reading list
   */
  async removeStory(
    listId: string,
    storyId: string,
    userId: string,
  ): Promise<ReadingList> {
    const readingList = await this.readingListRepository.findOne({
      where: { id: listId },
      relations: ["stories"],
    });

    if (!readingList) {
      throw new NotFoundException("Reading list not found");
    }

    if (readingList.userId !== userId) {
      throw new ForbiddenException(
        "You can only modify your own reading lists",
      );
    }

    readingList.stories = (readingList.stories || []).filter(
      (s) => s.id !== storyId,
    );
    readingList.storyCount = readingList.stories.length;

    return this.readingListRepository.save(readingList);
  }

  /**
   * Follow a reading list
   */
  async follow(listId: string, userId: string): Promise<ReadingListFollow> {
    const readingList = await this.readingListRepository.findOne({
      where: { id: listId },
    });

    if (!readingList) {
      throw new NotFoundException("Reading list not found");
    }

    if (!readingList.isPublic) {
      throw new ForbiddenException("Cannot follow a private reading list");
    }

    if (readingList.userId === userId) {
      throw new BadRequestException("Cannot follow your own reading list");
    }

    // Check existing follow
    const existingFollow = await this.readingListFollowRepository.findOne({
      where: { readingListId: listId, userId },
    });

    if (existingFollow) {
      throw new BadRequestException("Already following this reading list");
    }

    const follow = this.readingListFollowRepository.create({
      userId,
      readingListId: listId,
    });

    await this.readingListFollowRepository.save(follow);

    // Update follower count
    await this.readingListRepository.increment(
      { id: listId },
      "followersCount",
      1,
    );

    return follow;
  }

  /**
   * Unfollow a reading list
   */
  async unfollow(listId: string, userId: string): Promise<void> {
    const follow = await this.readingListFollowRepository.findOne({
      where: { readingListId: listId, userId },
    });

    if (!follow) {
      throw new NotFoundException("Not following this reading list");
    }

    await this.readingListFollowRepository.remove(follow);

    // Update follower count
    await this.readingListRepository.decrement(
      { id: listId },
      "followersCount",
      1,
    );
  }

  /**
   * Get followed reading lists
   */
  async getFollowedLists(userId: string): Promise<ReadingList[]> {
    const follows = await this.readingListFollowRepository.find({
      where: { userId },
      relations: ["readingList", "readingList.user"],
    });

    return follows.map((f) => f.readingList);
  }

  /**
   * Check if user is following a reading list
   */
  async isFollowing(listId: string, userId: string): Promise<boolean> {
    const follow = await this.readingListFollowRepository.findOne({
      where: { readingListId: listId, userId },
    });

    return !!follow;
  }

  /**
   * Get popular public reading lists
   */
  async getPopularLists(limit: number = 10): Promise<ReadingList[]> {
    return this.readingListRepository.find({
      where: { isPublic: true },
      relations: ["user"],
      order: { followersCount: "DESC" },
      take: limit,
    });
  }
}
