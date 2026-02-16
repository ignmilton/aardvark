import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  FeaturedContent,
  FeaturedType,
  FeaturedPlacement,
} from "@/database/entities/featured-content.entity";
import { Story, Collection, User } from "@/database/entities";
import {
  CreateFeaturedContentDto,
  UpdateFeaturedContentDto,
  FeaturedQueryDto,
} from "./dto";

@Injectable()
export class FeaturedService {
  constructor(
    @InjectRepository(FeaturedContent)
    private readonly featuredRepo: Repository<FeaturedContent>,
    @InjectRepository(Story)
    private readonly storyRepo: Repository<Story>,
    @InjectRepository(Collection)
    private readonly collectionRepo: Repository<Collection>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Get currently active featured content
   */
  async getActive(placement?: FeaturedPlacement) {
    const now = new Date();

    const qb = this.featuredRepo
      .createQueryBuilder("featured")
      .leftJoinAndSelect("featured.story", "story")
      .leftJoinAndSelect("story.author", "storyAuthor")
      .leftJoinAndSelect("featured.collection", "collection")
      .leftJoinAndSelect("featured.author", "author")
      .where("featured.isActive = :isActive", { isActive: true })
      .andWhere("featured.startDate <= :now", { now })
      .andWhere("(featured.endDate IS NULL OR featured.endDate >= :now)", {
        now,
      });

    if (placement) {
      qb.andWhere("featured.placement = :placement", { placement });
    }

    return qb
      .orderBy("featured.priority", "DESC")
      .addOrderBy("featured.startDate", "DESC")
      .getMany();
  }

  /**
   * Get all featured content (admin view)
   */
  async findAll(query: FeaturedQueryDto) {
    const { page = 1, limit = 20, type, placement, isActive } = query;

    const qb = this.featuredRepo
      .createQueryBuilder("featured")
      .leftJoinAndSelect("featured.story", "story")
      .leftJoinAndSelect("featured.collection", "collection")
      .leftJoinAndSelect("featured.author", "author")
      .leftJoinAndSelect("featured.createdBy", "createdBy");

    if (type) {
      qb.andWhere("featured.type = :type", { type });
    }

    if (placement) {
      qb.andWhere("featured.placement = :placement", { placement });
    }

    if (isActive !== undefined) {
      qb.andWhere("featured.isActive = :isActive", { isActive });
    }

    const [items, total] = await qb
      .orderBy("featured.priority", "DESC")
      .addOrderBy("featured.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get featured content by ID
   */
  async findOne(id: string): Promise<FeaturedContent> {
    const featured = await this.featuredRepo.findOne({
      where: { id },
      relations: ["story", "collection", "author", "createdBy"],
    });

    if (!featured) {
      throw new NotFoundException("Featured content not found");
    }

    return featured;
  }

  /**
   * Create new featured content
   */
  async create(
    userId: string,
    dto: CreateFeaturedContentDto,
  ): Promise<FeaturedContent> {
    // Validate referenced entity exists
    await this.validateReferences(dto);

    const featured = this.featuredRepo.create({
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      createdById: userId,
    });

    return this.featuredRepo.save(featured);
  }

  /**
   * Update featured content
   */
  async update(
    id: string,
    dto: UpdateFeaturedContentDto,
  ): Promise<FeaturedContent> {
    const featured = await this.findOne(id);

    // Validate new references if provided
    if (dto.storyId || dto.collectionId || dto.authorId) {
      await this.validateReferences(dto);
    }

    Object.assign(featured, {
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : featured.startDate,
      endDate: dto.endDate
        ? new Date(dto.endDate)
        : dto.endDate === null
          ? null
          : featured.endDate,
    });

    return this.featuredRepo.save(featured);
  }

  /**
   * Delete featured content
   */
  async delete(id: string): Promise<void> {
    const featured = await this.findOne(id);
    await this.featuredRepo.remove(featured);
  }

  /**
   * Toggle active status
   */
  async toggleActive(id: string): Promise<FeaturedContent> {
    const featured = await this.findOne(id);
    featured.isActive = !featured.isActive;
    return this.featuredRepo.save(featured);
  }

  /**
   * Get featured by placement for public display
   */
  async getByPlacement(placement: FeaturedPlacement, limit: number = 10) {
    const items = await this.getActive(placement);
    return items.slice(0, limit);
  }

  /**
   * Validate that referenced entities exist
   */
  private async validateReferences(
    dto: Partial<CreateFeaturedContentDto>,
  ): Promise<void> {
    if (dto.storyId) {
      const story = await this.storyRepo.findOne({
        where: { id: dto.storyId },
      });
      if (!story) {
        throw new BadRequestException("Story not found");
      }
    }

    if (dto.collectionId) {
      const collection = await this.collectionRepo.findOne({
        where: { id: dto.collectionId },
      });
      if (!collection) {
        throw new BadRequestException("Collection not found");
      }
    }

    if (dto.authorId) {
      const author = await this.userRepo.findOne({
        where: { id: dto.authorId },
      });
      if (!author) {
        throw new BadRequestException("Author not found");
      }
    }

    // Validate type matches references
    if (dto.type === FeaturedType.STORY && !dto.storyId) {
      throw new BadRequestException("Story ID required for story type");
    }

    if (dto.type === FeaturedType.COLLECTION && !dto.collectionId) {
      throw new BadRequestException(
        "Collection ID required for collection type",
      );
    }

    if (dto.type === FeaturedType.AUTHOR_SPOTLIGHT && !dto.authorId) {
      throw new BadRequestException(
        "Author ID required for author spotlight type",
      );
    }
  }
}
