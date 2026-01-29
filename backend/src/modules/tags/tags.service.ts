import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In, MoreThanOrEqual } from 'typeorm';
import { Tag, StoryTag, Story, TagAlias } from '@/database/entities';
import { TagType } from '@aardvark/shared';
import {
  CreateTagDto,
  UpdateTagDto,
  TagQueryDto,
  AddTagsToStoryDto,
  TagSuggestDto,
  BulkTagActionDto,
  CreateTagAliasDto,
} from './dto';

@Injectable()
export class TagsService {
  private readonly logger = new Logger(TagsService.name);

  constructor(
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(StoryTag)
    private readonly storyTagRepository: Repository<StoryTag>,
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(TagAlias)
    private readonly tagAliasRepository: Repository<TagAlias>,
  ) {}

  /**
   * Create a new tag
   */
  async create(createDto: CreateTagDto, isOfficial = false): Promise<Tag> {
    // Generate slug from name
    const slug = this.generateSlug(createDto.name);

    // Check for existing tag with same name or slug
    const existing = await this.tagRepository.findOne({
      where: [{ name: createDto.name }, { slug }],
    });

    if (existing) {
      throw new ConflictException('A tag with this name already exists');
    }

    // Validate parent tag if provided
    if (createDto.parentTagId) {
      const parentTag = await this.tagRepository.findOne({
        where: { id: createDto.parentTagId },
      });
      if (!parentTag) {
        throw new BadRequestException('Parent tag not found');
      }
    }

    const tag = this.tagRepository.create({
      name: createDto.name,
      slug,
      description: createDto.description || null,
      type: createDto.type,
      parentTagId: createDto.parentTagId || null,
      synonyms: createDto.synonyms || [],
      color: createDto.color || null,
      isOfficial,
      isFeatured: false,
      usageCount: 0,
    });

    return this.tagRepository.save(tag);
  }

  /**
   * Get all tags with filtering and pagination
   */
  async findAll(query: TagQueryDto) {
    const { search, type, featured, official, minUsage, page = 1, limit = 50, sortBy = 'usage' } = query;

    const queryBuilder = this.tagRepository.createQueryBuilder('tag');

    if (search) {
      queryBuilder.andWhere(
        '(tag.name ILIKE :search OR tag.slug ILIKE :search OR :search = ANY(tag.synonyms))',
        { search: `%${search}%` },
      );
    }

    if (type) {
      queryBuilder.andWhere('tag.type = :type', { type });
    }

    if (featured !== undefined) {
      queryBuilder.andWhere('tag.isFeatured = :featured', { featured });
    }

    if (official !== undefined) {
      queryBuilder.andWhere('tag.isOfficial = :official', { official });
    }

    if (minUsage !== undefined) {
      queryBuilder.andWhere('tag.usageCount >= :minUsage', { minUsage });
    }

    // Sorting
    switch (sortBy) {
      case 'name':
        queryBuilder.orderBy('tag.name', 'ASC');
        break;
      case 'trending':
        // Simple trending: recently updated with high usage
        queryBuilder
          .orderBy('tag.usageCount', 'DESC')
          .addOrderBy('tag.updatedAt', 'DESC');
        break;
      case 'recent':
        queryBuilder.orderBy('tag.createdAt', 'DESC');
        break;
      case 'usage':
      default:
        queryBuilder.orderBy('tag.usageCount', 'DESC');
    }

    const skip = (page - 1) * limit;
    const [tags, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: tags,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a tag by ID or slug
   */
  async findOne(idOrSlug: string): Promise<Tag> {
    const tag = await this.tagRepository.findOne({
      where: [{ id: idOrSlug }, { slug: idOrSlug }],
      relations: ['parentTag', 'childTags'],
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return tag;
  }

  /**
   * Get tag with story count
   */
  async findOneWithStats(idOrSlug: string) {
    const tag = await this.findOne(idOrSlug);

    const storiesCount = await this.storyTagRepository.count({
      where: { tagId: tag.id },
    });

    // Get related tags (tags that often appear with this tag)
    const relatedTags = await this.getRelatedTags(tag.id, 5);

    return {
      ...tag,
      storiesCount,
      relatedTags,
    };
  }

  /**
   * Update a tag
   */
  async update(id: string, updateDto: UpdateTagDto): Promise<Tag> {
    const tag = await this.tagRepository.findOne({ where: { id } });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    // If name is being updated, regenerate slug
    if (updateDto.name && updateDto.name !== tag.name) {
      const newSlug = this.generateSlug(updateDto.name);
      const existing = await this.tagRepository.findOne({
        where: [{ name: updateDto.name }, { slug: newSlug }],
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('A tag with this name already exists');
      }
      tag.name = updateDto.name;
      tag.slug = newSlug;
    }

    if (updateDto.description !== undefined) {
      tag.description = updateDto.description || null;
    }

    if (updateDto.type !== undefined) {
      tag.type = updateDto.type;
    }

    if (updateDto.parentTagId !== undefined) {
      if (updateDto.parentTagId === id) {
        throw new BadRequestException('A tag cannot be its own parent');
      }
      tag.parentTagId = updateDto.parentTagId || null;
    }

    if (updateDto.synonyms !== undefined) {
      tag.synonyms = updateDto.synonyms;
    }

    if (updateDto.color !== undefined) {
      tag.color = updateDto.color || null;
    }

    if (updateDto.isFeatured !== undefined) {
      tag.isFeatured = updateDto.isFeatured;
    }

    if (updateDto.isOfficial !== undefined) {
      tag.isOfficial = updateDto.isOfficial;
    }

    return this.tagRepository.save(tag);
  }

  /**
   * Delete a tag
   */
  async delete(id: string): Promise<void> {
    const tag = await this.tagRepository.findOne({ where: { id } });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    // Check if tag has children
    const childCount = await this.tagRepository.count({
      where: { parentTagId: id },
    });

    if (childCount > 0) {
      throw new BadRequestException('Cannot delete a tag with child tags. Delete or reassign children first.');
    }

    await this.tagRepository.remove(tag);
  }

  /**
   * Get popular/trending tags
   */
  async getPopularTags() {
    // Featured tags
    const featured = await this.tagRepository.find({
      where: { isFeatured: true },
      order: { usageCount: 'DESC' },
      take: 10,
    });

    // Most used tags
    const mostUsed = await this.tagRepository.find({
      where: { usageCount: MoreThanOrEqual(1) },
      order: { usageCount: 'DESC' },
      take: 20,
    });

    // Trending (recently updated with usage)
    const trending = await this.tagRepository
      .createQueryBuilder('tag')
      .where('tag.usageCount > 0')
      .orderBy('tag.updatedAt', 'DESC')
      .addOrderBy('tag.usageCount', 'DESC')
      .take(10)
      .getMany();

    // Group by type
    const byType = await this.getTagsByType();

    return {
      featured,
      mostUsed,
      trending,
      byType,
    };
  }

  /**
   * Get tags grouped by type
   */
  async getTagsByType() {
    const types = Object.values(TagType);
    const groups = [];

    for (const type of types) {
      const tags = await this.tagRepository.find({
        where: { type, usageCount: MoreThanOrEqual(1) },
        order: { usageCount: 'DESC' },
        take: 10,
      });

      if (tags.length > 0) {
        groups.push({
          type,
          typeName: this.getTypeName(type),
          tags,
        });
      }
    }

    return groups;
  }

  /**
   * Tag autocomplete/suggestions
   */
  async suggest(dto: TagSuggestDto) {
    const { prefix, type, limit = 10 } = dto;

    const queryBuilder = this.tagRepository
      .createQueryBuilder('tag')
      .where('tag.name ILIKE :prefix', { prefix: `${prefix}%` })
      .orWhere('tag.slug ILIKE :prefix', { prefix: `${prefix}%` });

    if (type) {
      queryBuilder.andWhere('tag.type = :type', { type });
    }

    const tags = await queryBuilder
      .orderBy('tag.usageCount', 'DESC')
      .take(limit)
      .getMany();

    return tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      type: tag.type,
      usageCount: tag.usageCount,
    }));
  }

  /**
   * Add tags to a story
   */
  async addTagsToStory(storyId: string, dto: AddTagsToStoryDto, userId: string): Promise<Tag[]> {
    const story = await this.storyRepository.findOne({ where: { id: storyId } });
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    const tags = await this.tagRepository.find({
      where: { id: In(dto.tagIds) },
    });

    if (tags.length !== dto.tagIds.length) {
      throw new BadRequestException('One or more tags not found');
    }

    // Add story tags (ignore duplicates)
    for (const tag of tags) {
      const existing = await this.storyTagRepository.findOne({
        where: { storyId, tagId: tag.id },
      });

      if (!existing) {
        await this.storyTagRepository.save({
          storyId,
          tagId: tag.id,
          addedByUserId: userId,
        });

        // Increment usage count
        await this.tagRepository.increment({ id: tag.id }, 'usageCount', 1);
      }
    }

    return tags;
  }

  /**
   * Remove a tag from a story
   */
  async removeTagFromStory(storyId: string, tagId: string): Promise<void> {
    const storyTag = await this.storyTagRepository.findOne({
      where: { storyId, tagId },
    });

    if (!storyTag) {
      throw new NotFoundException('Tag not associated with this story');
    }

    await this.storyTagRepository.remove(storyTag);

    // Decrement usage count
    await this.tagRepository.decrement({ id: tagId }, 'usageCount', 1);
  }

  /**
   * Get tags for a story
   */
  async getStoryTags(storyId: string): Promise<Tag[]> {
    const storyTags = await this.storyTagRepository.find({
      where: { storyId },
      relations: ['tag'],
    });

    return storyTags.map((st) => st.tag);
  }

  /**
   * Get stories by tag
   */
  async getStoriesByTag(tagIdOrSlug: string, page = 1, limit = 20) {
    const tag = await this.findOne(tagIdOrSlug);

    const queryBuilder = this.storyRepository
      .createQueryBuilder('story')
      .innerJoin('story_tags', 'st', 'st.storyId = story.id')
      .leftJoinAndSelect('story.author', 'author')
      .where('st.tagId = :tagId', { tagId: tag.id })
      .andWhere('story.status = :status', { status: 'published' });

    const skip = (page - 1) * limit;
    const [stories, total] = await queryBuilder
      .orderBy('story.averageRating', 'DESC')
      .addOrderBy('story.viewCount', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      tag,
      data: stories,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Bulk tag operations (admin)
   */
  async bulkAction(dto: BulkTagActionDto): Promise<{ affected: number }> {
    const tags = await this.tagRepository.find({
      where: { id: In(dto.tagIds) },
    });

    if (tags.length === 0) {
      throw new NotFoundException('No tags found');
    }

    let affected = 0;

    switch (dto.action) {
      case 'feature':
        await this.tagRepository.update(
          { id: In(dto.tagIds) },
          { isFeatured: true },
        );
        affected = tags.length;
        break;

      case 'unfeature':
        await this.tagRepository.update(
          { id: In(dto.tagIds) },
          { isFeatured: false },
        );
        affected = tags.length;
        break;

      case 'merge':
        if (!dto.targetTagId) {
          throw new BadRequestException('Target tag ID required for merge');
        }
        affected = await this.mergeTags(dto.tagIds, dto.targetTagId);
        break;

      case 'delete':
        for (const tag of tags) {
          try {
            await this.delete(tag.id);
            affected++;
          } catch (e) {
            this.logger.warn(`Failed to delete tag ${tag.id}: ${e.message}`);
          }
        }
        break;
    }

    return { affected };
  }

  /**
   * Merge multiple tags into one
   */
  private async mergeTags(sourceTagIds: string[], targetTagId: string): Promise<number> {
    const targetTag = await this.tagRepository.findOne({
      where: { id: targetTagId },
    });

    if (!targetTag) {
      throw new NotFoundException('Target tag not found');
    }

    // Filter out target from sources
    const sourceIds = sourceTagIds.filter((id) => id !== targetTagId);

    // Move all story_tags to target
    let affected = 0;
    for (const sourceId of sourceIds) {
      const storyTags = await this.storyTagRepository.find({
        where: { tagId: sourceId },
      });

      for (const st of storyTags) {
        // Check if target already has this story
        const existing = await this.storyTagRepository.findOne({
          where: { storyId: st.storyId, tagId: targetTagId },
        });

        if (!existing) {
          st.tagId = targetTagId;
          await this.storyTagRepository.save(st);
        } else {
          await this.storyTagRepository.remove(st);
        }
      }

      // Delete source tag
      await this.tagRepository.delete(sourceId);
      affected++;
    }

    // Update usage count
    const count = await this.storyTagRepository.count({
      where: { tagId: targetTagId },
    });
    await this.tagRepository.update(targetTagId, { usageCount: count });

    return affected;
  }

  /**
   * Get related tags (tags that often appear with the given tag)
   */
  private async getRelatedTags(tagId: string, limit = 5): Promise<Tag[]> {
    const result = await this.storyTagRepository
      .createQueryBuilder('st')
      .select('st2.tagId', 'relatedTagId')
      .addSelect('COUNT(*)', 'count')
      .innerJoin('story_tags', 'st2', 'st2.storyId = st.storyId AND st2.tagId != :tagId', { tagId })
      .where('st.tagId = :tagId', { tagId })
      .groupBy('st2.tagId')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    if (result.length === 0) {
      return [];
    }

    const relatedTagIds = result.map((r) => r.relatedTagId);
    return this.tagRepository.find({
      where: { id: In(relatedTagIds) },
    });
  }

  /**
   * Get or create tag by name (for user input)
   */
  async getOrCreateByName(name: string, type: TagType = TagType.CUSTOM): Promise<Tag> {
    const slug = this.generateSlug(name);

    let tag = await this.tagRepository.findOne({
      where: [{ slug }, { name: ILike(name) }],
    });

    if (!tag) {
      tag = await this.create({ name, type }, false);
    }

    return tag;
  }

  /**
   * Generate URL-friendly slug from tag name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Get human-readable type name
   */
  private getTypeName(type: TagType): string {
    const names: Record<TagType, string> = {
      [TagType.GENRE]: 'Genres',
      [TagType.THEME]: 'Themes',
      [TagType.MOOD]: 'Moods',
      [TagType.SETTING]: 'Settings',
      [TagType.CHARACTER]: 'Character Types',
      [TagType.TROPE]: 'Tropes',
      [TagType.CONTENT]: 'Content Types',
      [TagType.CUSTOM]: 'Other',
    };
    return names[type] || type;
  }

  // ============================================================================
  // Tag Alias Methods
  // ============================================================================

  /**
   * Get all aliases for a tag
   */
  async getTagAliases(tagId: string): Promise<TagAlias[]> {
    const tag = await this.tagRepository.findOne({ where: { id: tagId } });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return this.tagAliasRepository.find({
      where: { tagId },
      order: { alias: 'ASC' },
    });
  }

  /**
   * Add an alias to a tag
   */
  async addTagAlias(tagId: string, dto: CreateTagAliasDto): Promise<TagAlias> {
    const tag = await this.tagRepository.findOne({ where: { id: tagId } });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    // Normalize alias
    const normalizedAlias = dto.alias.toLowerCase().trim();

    // Check if alias already exists (globally unique)
    const existingAlias = await this.tagAliasRepository.findOne({
      where: { alias: normalizedAlias },
    });

    if (existingAlias) {
      throw new ConflictException('This alias is already in use');
    }

    // Check if alias matches an existing tag name or slug
    const existingTag = await this.tagRepository.findOne({
      where: [{ name: ILike(normalizedAlias) }, { slug: normalizedAlias }],
    });

    if (existingTag) {
      throw new ConflictException('This alias conflicts with an existing tag name');
    }

    const alias = this.tagAliasRepository.create({
      tagId,
      alias: normalizedAlias,
    });

    return this.tagAliasRepository.save(alias);
  }

  /**
   * Remove an alias from a tag
   */
  async removeTagAlias(tagId: string, aliasId: string): Promise<void> {
    const alias = await this.tagAliasRepository.findOne({
      where: { id: aliasId, tagId },
    });

    if (!alias) {
      throw new NotFoundException('Alias not found');
    }

    await this.tagAliasRepository.remove(alias);
  }

  /**
   * Find a tag by alias
   */
  async findTagByAlias(aliasText: string): Promise<Tag | null> {
    const normalizedAlias = aliasText.toLowerCase().trim();

    const alias = await this.tagAliasRepository.findOne({
      where: { alias: normalizedAlias },
      relations: ['tag'],
    });

    return alias?.tag || null;
  }

  /**
   * Search tags including aliases
   */
  async searchWithAliases(search: string, limit = 10): Promise<Tag[]> {
    const normalizedSearch = search.toLowerCase().trim();

    // Search in tag names and slugs
    const directMatches = await this.tagRepository.find({
      where: [
        { name: ILike(`%${normalizedSearch}%`) },
        { slug: ILike(`%${normalizedSearch}%`) },
      ],
      take: limit,
    });

    // Search in aliases
    const aliasMatches = await this.tagAliasRepository.find({
      where: { alias: ILike(`%${normalizedSearch}%`) },
      relations: ['tag'],
      take: limit,
    });

    // Combine and deduplicate
    const tagMap = new Map<string, Tag>();
    for (const tag of directMatches) {
      tagMap.set(tag.id, tag);
    }
    for (const alias of aliasMatches) {
      if (!tagMap.has(alias.tag.id)) {
        tagMap.set(alias.tag.id, alias.tag);
      }
    }

    return Array.from(tagMap.values()).slice(0, limit);
  }
}
