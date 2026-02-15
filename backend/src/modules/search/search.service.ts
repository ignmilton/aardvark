import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Client } from "@elastic/elasticsearch";
import { Story, User, Tag, StoryTag, SearchHistory } from "@/database/entities";
import { SearchStoriesDto, SearchUsersDto, AutocompleteDto } from "./dto";
import { StoryStatus, TagType } from "@aardvark/shared";

const STORIES_INDEX = "aardvark_stories";
const USERS_INDEX = "aardvark_users";
const TAGS_INDEX = "aardvark_tags";

interface StoryDocument {
  id: string;
  title: string;
  description: string;
  synopsis: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  category: string;
  tags: string[];
  contentWarnings: string[];
  collaborationMode: string;
  isPremium: boolean;
  language: string;
  length: string;
  complexity: string;
  viewCount: number;
  averageRating: number;
  ratingCount: number;
  publishedAt: Date;
  updatedAt: Date;
  suggest: {
    input: string[];
    weight: number;
  };
}

interface UserDocument {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  role: string;
  storiesCount: number;
  followersCount: number;
  suggest: {
    input: string[];
    weight: number;
  };
}

interface TagDocument {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: string;
  usageCount: number;
  isOfficial: boolean;
  isFeatured: boolean;
  synonyms: string[];
  suggest: {
    input: string[];
    weight: number;
  };
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private client: Client;
  private isConnected = false;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(StoryTag)
    private readonly storyTagRepository: Repository<StoryTag>,
    @InjectRepository(SearchHistory)
    private readonly searchHistoryRepository: Repository<SearchHistory>,
  ) {}

  async onModuleInit() {
    try {
      const esConfig = this.configService.get("elasticsearch");

      this.client = new Client({
        node: esConfig.node,
        auth: esConfig.username
          ? {
              username: esConfig.username,
              password: esConfig.password,
            }
          : undefined,
      });

      // Test connection
      await this.client.ping();
      this.isConnected = true;
      this.logger.log("Connected to Elasticsearch");

      // Initialize indices
      await this.initializeIndices();
    } catch (error) {
      this.logger.error(
        `Failed to connect to Elasticsearch: ${error.message}. Search will fall back to database queries. ` +
          `Ensure Elasticsearch is running at ${this.configService.get("elasticsearch.node", "http://localhost:9200")}.`,
      );
      this.isConnected = false;
    }
  }

  /**
   * Initialize Elasticsearch indices with mappings
   */
  private async initializeIndices() {
    // Stories index
    const storiesExists = await this.client.indices.exists({
      index: STORIES_INDEX,
    });
    if (!storiesExists) {
      await this.client.indices.create({
        index: STORIES_INDEX,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                story_analyzer: {
                  type: "custom",
                  tokenizer: "standard",
                  filter: ["lowercase", "asciifolding", "porter_stem"],
                },
              },
            },
          },
          mappings: {
            properties: {
              id: { type: "keyword" },
              title: {
                type: "text",
                analyzer: "story_analyzer",
                fields: { keyword: { type: "keyword" } },
              },
              description: { type: "text", analyzer: "story_analyzer" },
              synopsis: { type: "text", analyzer: "story_analyzer" },
              authorId: { type: "keyword" },
              authorUsername: { type: "keyword" },
              authorDisplayName: { type: "text" },
              category: { type: "keyword" },
              tags: { type: "keyword" },
              contentWarnings: { type: "keyword" },
              collaborationMode: { type: "keyword" },
              isPremium: { type: "boolean" },
              language: { type: "keyword" },
              length: { type: "keyword" },
              complexity: { type: "keyword" },
              viewCount: { type: "integer" },
              averageRating: { type: "float" },
              ratingCount: { type: "integer" },
              publishedAt: { type: "date" },
              updatedAt: { type: "date" },
              suggest: { type: "completion", analyzer: "simple" },
            },
          },
        },
      });
      this.logger.log("Created stories index");
    }

    // Users index
    const usersExists = await this.client.indices.exists({
      index: USERS_INDEX,
    });
    if (!usersExists) {
      await this.client.indices.create({
        index: USERS_INDEX,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
          },
          mappings: {
            properties: {
              id: { type: "keyword" },
              username: {
                type: "text",
                fields: { keyword: { type: "keyword" } },
              },
              displayName: { type: "text" },
              bio: { type: "text" },
              role: { type: "keyword" },
              storiesCount: { type: "integer" },
              followersCount: { type: "integer" },
              suggest: { type: "completion", analyzer: "simple" },
            },
          },
        },
      });
      this.logger.log("Created users index");
    }

    // Tags index
    const tagsExists = await this.client.indices.exists({ index: TAGS_INDEX });
    if (!tagsExists) {
      await this.client.indices.create({
        index: TAGS_INDEX,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                tag_analyzer: {
                  type: "custom",
                  tokenizer: "standard",
                  filter: ["lowercase", "asciifolding"],
                },
              },
            },
          },
          mappings: {
            properties: {
              id: { type: "keyword" },
              name: {
                type: "text",
                analyzer: "tag_analyzer",
                fields: { keyword: { type: "keyword" } },
              },
              slug: { type: "keyword" },
              description: { type: "text", analyzer: "tag_analyzer" },
              type: { type: "keyword" },
              usageCount: { type: "integer" },
              isOfficial: { type: "boolean" },
              isFeatured: { type: "boolean" },
              synonyms: { type: "text", analyzer: "tag_analyzer" },
              suggest: { type: "completion", analyzer: "simple" },
            },
          },
        },
      });
      this.logger.log("Created tags index");
    }
  }

  /**
   * Search stories
   */
  async searchStories(dto: SearchStoriesDto) {
    if (!this.isConnected) {
      return this.fallbackSearchStories(dto);
    }

    const { query, page = 1, limit = 20 } = dto;
    const from = (page - 1) * limit;

    // Build query
    const must: any[] = [
      {
        multi_match: {
          query,
          fields: [
            "title^3",
            "description^2",
            "synopsis",
            "tags^2",
            "authorUsername",
            "authorDisplayName",
          ],
          fuzziness: "AUTO",
        },
      },
    ];

    const filter: any[] = [];

    if (dto.categories?.length) {
      filter.push({ terms: { category: dto.categories } });
    }

    if (dto.tags?.length) {
      filter.push({ terms: { tags: dto.tags } });
    }

    if (dto.excludeWarnings?.length) {
      filter.push({
        bool: {
          must_not: { terms: { contentWarnings: dto.excludeWarnings } },
        },
      });
    }

    if (dto.length) {
      filter.push({ term: { length: dto.length } });
    }

    if (dto.complexity) {
      filter.push({ term: { complexity: dto.complexity } });
    }

    if (dto.minRating !== undefined) {
      filter.push({ range: { averageRating: { gte: dto.minRating } } });
    }

    if (dto.freeOnly) {
      filter.push({ term: { isPremium: false } });
    }

    if (dto.authorId) {
      filter.push({ term: { authorId: dto.authorId } });
    }

    if (dto.language) {
      filter.push({ term: { language: dto.language } });
    }

    // Build sort
    let sort: any[] = [];
    switch (dto.sortBy) {
      case "rating":
        sort = [{ averageRating: "desc" }, { ratingCount: "desc" }];
        break;
      case "views":
        sort = [{ viewCount: "desc" }];
        break;
      case "recent":
        sort = [{ publishedAt: "desc" }];
        break;
      case "trending":
        // Simple trending: combine views and recency
        sort = [
          { _score: "desc" },
          { viewCount: "desc" },
          { publishedAt: "desc" },
        ];
        break;
      case "relevance":
      default:
        sort = [{ _score: "desc" }];
    }

    try {
      const result = await this.client.search({
        index: STORIES_INDEX,
        body: {
          from,
          size: limit,
          query: {
            bool: {
              must,
              filter,
            },
          },
          sort,
        },
      });

      const hits = result.hits.hits as any[];
      const total =
        typeof result.hits.total === "number"
          ? result.hits.total
          : result.hits.total?.value || 0;

      return {
        data: hits.map((hit) => ({
          ...hit._source,
          score: hit._score,
        })),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error("Elasticsearch search failed", error);
      return this.fallbackSearchStories(dto);
    }
  }

  /**
   * Search users
   */
  async searchUsers(dto: SearchUsersDto) {
    if (!this.isConnected) {
      return this.fallbackSearchUsers(dto);
    }

    const { query, page = 1, limit = 20 } = dto;
    const from = (page - 1) * limit;

    try {
      const result = await this.client.search({
        index: USERS_INDEX,
        body: {
          from,
          size: limit,
          query: {
            multi_match: {
              query,
              fields: ["username^3", "displayName^2", "bio"],
              fuzziness: "AUTO",
            },
          },
          sort: [{ _score: "desc" }, { followersCount: "desc" }],
        },
      });

      const hits = result.hits.hits as any[];
      const total =
        typeof result.hits.total === "number"
          ? result.hits.total
          : result.hits.total?.value || 0;

      return {
        data: hits.map((hit) => hit._source),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error("Elasticsearch user search failed", error);
      return this.fallbackSearchUsers(dto);
    }
  }

  /**
   * Autocomplete suggestions
   */
  async autocomplete(dto: AutocompleteDto) {
    if (!this.isConnected) {
      return { suggestions: [] };
    }

    const index = dto.type === "user" ? USERS_INDEX : STORIES_INDEX;

    try {
      const result = await this.client.search({
        index,
        body: {
          suggest: {
            story_suggest: {
              prefix: dto.prefix,
              completion: {
                field: "suggest",
                size: dto.limit,
                fuzzy: {
                  fuzziness: "AUTO",
                },
              },
            },
          },
        },
      });

      const suggestions =
        (result.suggest as any)?.story_suggest?.[0]?.options || [];

      return {
        suggestions: suggestions.map((s: any) => ({
          text: s.text,
          id: s._source.id,
          ...(dto.type === "story" && { category: s._source.category }),
          ...(dto.type === "user" && { username: s._source.username }),
        })),
      };
    } catch (error) {
      this.logger.error("Autocomplete failed", error);
      return { suggestions: [] };
    }
  }

  /**
   * Index a story
   */
  async indexStory(story: Story & { author?: User }): Promise<void> {
    if (!this.isConnected) return;

    const doc: StoryDocument = {
      id: story.id,
      title: story.title,
      description: story.description,
      synopsis: story.synopsis || "",
      authorId: story.authorId,
      authorUsername: story.author?.username || "",
      authorDisplayName:
        story.author?.displayName || story.author?.username || "",
      category: story.category,
      tags: story.tags,
      contentWarnings: story.contentWarnings,
      collaborationMode: story.collaborationMode,
      isPremium: story.isPremium,
      language: story.language,
      length: story.length,
      complexity: story.complexity,
      viewCount: story.viewCount,
      averageRating: story.averageRating,
      ratingCount: story.ratingsCount,
      publishedAt: story.publishedAt!,
      updatedAt: story.updatedAt,
      suggest: {
        input: [story.title, ...story.tags],
        weight: Math.round(story.averageRating * story.ratingsCount),
      },
    };

    try {
      await this.client.index({
        index: STORIES_INDEX,
        id: story.id,
        body: doc,
        refresh: true,
      });
    } catch (error) {
      this.logger.error(`Failed to index story ${story.id}`, error);
    }
  }

  /**
   * Remove a story from index
   */
  async removeStory(storyId: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.client.delete({
        index: STORIES_INDEX,
        id: storyId,
        refresh: true,
      });
    } catch (error) {
      this.logger.error(`Failed to remove story ${storyId} from index`, error);
    }
  }

  /**
   * Index a user
   */
  async indexUser(
    user: User,
    storiesCount: number,
    followersCount: number,
  ): Promise<void> {
    if (!this.isConnected) return;

    const doc: UserDocument = {
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      bio: user.bio || "",
      role: user.role,
      storiesCount,
      followersCount,
      suggest: {
        input: [user.username, user.displayName].filter(Boolean) as string[],
        weight: followersCount,
      },
    };

    try {
      await this.client.index({
        index: USERS_INDEX,
        id: user.id,
        body: doc,
        refresh: true,
      });
    } catch (error) {
      this.logger.error(`Failed to index user ${user.id}`, error);
    }
  }

  /**
   * Reindex all stories (admin function)
   */
  async reindexAllStories(): Promise<{ indexed: number; failed: number }> {
    if (!this.isConnected) {
      return { indexed: 0, failed: 0 };
    }

    const stories = await this.storyRepository.find({
      where: { status: StoryStatus.PUBLISHED },
      relations: ["author"],
    });

    let indexed = 0;
    let failed = 0;

    for (const story of stories) {
      try {
        await this.indexStory(story);
        indexed++;
      } catch {
        failed++;
      }
    }

    return { indexed, failed };
  }

  // ============================================================================
  // Tag Search Methods
  // ============================================================================

  /**
   * Search tags
   */
  async searchTags(query: string, type?: TagType, limit = 20, page = 1) {
    if (!this.isConnected) {
      return this.fallbackSearchTags(query, type, limit, page);
    }

    const from = (page - 1) * limit;

    const must: any[] = [
      {
        multi_match: {
          query,
          fields: ["name^3", "description", "synonyms^2"],
          fuzziness: "AUTO",
        },
      },
    ];

    const filter: any[] = [];
    if (type) {
      filter.push({ term: { type } });
    }

    try {
      const result = await this.client.search({
        index: TAGS_INDEX,
        body: {
          from,
          size: limit,
          query: {
            bool: {
              must,
              filter,
            },
          },
          sort: [{ _score: "desc" }, { usageCount: "desc" }],
        },
      });

      const hits = result.hits.hits as any[];
      const total =
        typeof result.hits.total === "number"
          ? result.hits.total
          : result.hits.total?.value || 0;

      return {
        data: hits.map((hit) => ({
          ...hit._source,
          score: hit._score,
        })),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error("Tag search failed", error);
      return this.fallbackSearchTags(query, type, limit, page);
    }
  }

  /**
   * Index a tag
   */
  async indexTag(tag: Tag): Promise<void> {
    if (!this.isConnected) return;

    const doc: TagDocument = {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      description: tag.description || "",
      type: tag.type,
      usageCount: tag.usageCount,
      isOfficial: tag.isOfficial,
      isFeatured: tag.isFeatured,
      synonyms: tag.synonyms,
      suggest: {
        input: [tag.name, ...tag.synonyms],
        weight: tag.usageCount,
      },
    };

    try {
      await this.client.index({
        index: TAGS_INDEX,
        id: tag.id,
        body: doc,
        refresh: true,
      });
    } catch (error) {
      this.logger.error(`Failed to index tag ${tag.id}`, error);
    }
  }

  /**
   * Remove a tag from index
   */
  async removeTag(tagId: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.client.delete({
        index: TAGS_INDEX,
        id: tagId,
        refresh: true,
      });
    } catch (error) {
      this.logger.error(`Failed to remove tag ${tagId} from index`, error);
    }
  }

  /**
   * Reindex all tags
   */
  async reindexAllTags(): Promise<{ indexed: number; failed: number }> {
    if (!this.isConnected) {
      return { indexed: 0, failed: 0 };
    }

    const tags = await this.tagRepository.find();

    let indexed = 0;
    let failed = 0;

    for (const tag of tags) {
      try {
        await this.indexTag(tag);
        indexed++;
      } catch {
        failed++;
      }
    }

    return { indexed, failed };
  }

  /**
   * Get tag facets/aggregations for story search
   */
  async getTagAggregations(
    storyIds?: string[],
  ): Promise<{ tag: string; count: number }[]> {
    if (storyIds && storyIds.length > 0) {
      // Get tag counts for specific stories
      const result = await this.storyTagRepository
        .createQueryBuilder("st")
        .select("tag.name", "tag")
        .addSelect("COUNT(*)", "count")
        .innerJoin("st.tag", "tag")
        .where("st.storyId IN (:...storyIds)", { storyIds })
        .groupBy("tag.name")
        .orderBy("count", "DESC")
        .limit(50)
        .getRawMany();

      return result;
    }

    // Get overall tag counts
    const result = await this.tagRepository
      .createQueryBuilder("tag")
      .select("tag.name", "tag")
      .addSelect("tag.usageCount", "count")
      .where("tag.usageCount > 0")
      .orderBy("tag.usageCount", "DESC")
      .limit(50)
      .getRawMany();

    return result;
  }

  /**
   * Advanced search with tag-based filtering
   */
  async advancedSearch(params: {
    query?: string;
    tagIds?: string[];
    tagNames?: string[];
    matchAllTags?: boolean;
    categories?: string[];
    minRating?: number;
    page?: number;
    limit?: number;
  }) {
    const {
      query,
      tagIds,
      tagNames,
      matchAllTags = false,
      categories,
      minRating,
      page = 1,
      limit = 20,
    } = params;

    // If we have tags, find stories with those tags first
    let storyIdsFromTags: string[] | null = null;

    if ((tagIds && tagIds.length > 0) || (tagNames && tagNames.length > 0)) {
      let tagIdsToSearch = tagIds || [];

      // Convert tag names to IDs if needed
      if (tagNames && tagNames.length > 0) {
        const tagsByName = await this.tagRepository
          .createQueryBuilder("tag")
          .where("LOWER(tag.name) IN (:...names)", {
            names: tagNames.map((n) => n.toLowerCase()),
          })
          .getMany();
        tagIdsToSearch = [...tagIdsToSearch, ...tagsByName.map((t) => t.id)];
      }

      if (tagIdsToSearch.length > 0) {
        if (matchAllTags) {
          // Stories must have ALL specified tags
          const storiesWithAllTags = await this.storyTagRepository
            .createQueryBuilder("st")
            .select("st.storyId")
            .where("st.tagId IN (:...tagIds)", { tagIds: tagIdsToSearch })
            .groupBy("st.storyId")
            .having("COUNT(DISTINCT st.tagId) = :count", {
              count: tagIdsToSearch.length,
            })
            .getRawMany();
          storyIdsFromTags = storiesWithAllTags.map((s) => s.st_storyId);
        } else {
          // Stories must have ANY of the specified tags
          const storiesWithAnyTag = await this.storyTagRepository.find({
            where: { tagId: In(tagIdsToSearch) },
            select: ["storyId"],
          });
          storyIdsFromTags = [
            ...new Set(storiesWithAnyTag.map((s) => s.storyId)),
          ];
        }

        if (storyIdsFromTags.length === 0) {
          return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
        }
      }
    }

    // Build story query
    const queryBuilder = this.storyRepository
      .createQueryBuilder("story")
      .leftJoinAndSelect("story.author", "author")
      .where("story.status = :status", { status: StoryStatus.PUBLISHED });

    if (storyIdsFromTags) {
      queryBuilder.andWhere("story.id IN (:...storyIds)", {
        storyIds: storyIdsFromTags,
      });
    }

    if (query) {
      queryBuilder.andWhere(
        "(story.title ILIKE :query OR story.description ILIKE :query)",
        { query: `%${query}%` },
      );
    }

    if (categories && categories.length > 0) {
      queryBuilder.andWhere("story.category IN (:...categories)", {
        categories,
      });
    }

    if (minRating !== undefined) {
      queryBuilder.andWhere("story.averageRating >= :minRating", { minRating });
    }

    const skip = (page - 1) * limit;
    const [stories, total] = await queryBuilder
      .orderBy("story.averageRating", "DESC")
      .addOrderBy("story.viewCount", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Get tags for each story
    const storiesWithTags = await Promise.all(
      stories.map(async (story) => {
        const storyTags = await this.storyTagRepository.find({
          where: { storyId: story.id },
          relations: ["tag"],
        });
        return {
          ...story,
          storyTags: storyTags.map((st) => st.tag),
        };
      }),
    );

    return {
      data: storiesWithTags,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================================================
  // Fallback Methods (when Elasticsearch is unavailable)
  // ============================================================================

  private async fallbackSearchTags(
    query: string,
    type?: TagType,
    limit = 20,
    page = 1,
  ) {
    const queryBuilder = this.tagRepository
      .createQueryBuilder("tag")
      .where("(tag.name ILIKE :query OR tag.slug ILIKE :query)", {
        query: `%${query}%`,
      });

    if (type) {
      queryBuilder.andWhere("tag.type = :type", { type });
    }

    const skip = (page - 1) * limit;
    const [tags, total] = await queryBuilder
      .orderBy("tag.usageCount", "DESC")
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

  private async fallbackSearchStories(dto: SearchStoriesDto) {
    const { query, page = 1, limit = 20 } = dto;

    const queryBuilder = this.storyRepository
      .createQueryBuilder("story")
      .leftJoinAndSelect("story.author", "author")
      .where("story.status = :status", { status: StoryStatus.PUBLISHED })
      .andWhere(
        "(story.title ILIKE :query OR story.description ILIKE :query OR story.tags::text ILIKE :query)",
        { query: `%${query}%` },
      );

    if (dto.categories?.length) {
      queryBuilder.andWhere("story.category IN (:...categories)", {
        categories: dto.categories,
      });
    }

    if (dto.minRating !== undefined) {
      queryBuilder.andWhere("story.averageRating >= :minRating", {
        minRating: dto.minRating,
      });
    }

    if (dto.freeOnly) {
      queryBuilder.andWhere("story.isPremium = false");
    }

    if (dto.authorId) {
      queryBuilder.andWhere("story.authorId = :authorId", {
        authorId: dto.authorId,
      });
    }

    const skip = (page - 1) * limit;
    const [stories, total] = await queryBuilder
      .orderBy("story.averageRating", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: stories,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async fallbackSearchUsers(dto: SearchUsersDto) {
    const { query, page = 1, limit = 20 } = dto;

    const queryBuilder = this.userRepository
      .createQueryBuilder("user")
      .where("user.accountStatus = :status", { status: "active" })
      .andWhere(
        "(user.username ILIKE :query OR user.displayName ILIKE :query)",
        { query: `%${query}%` },
      );

    const skip = (page - 1) * limit;
    const [users, total] = await queryBuilder
      .orderBy("user.createdAt", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        bio: u.bio,
        role: u.role,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================================================
  // Search History Methods
  // ============================================================================

  /**
   * Record a search query for a user
   */
  async recordSearch(
    userId: string,
    query: string,
    filters?: Record<string, unknown>,
    resultsCount?: number,
  ): Promise<SearchHistory> {
    // Check if this query already exists for the user
    const existingSearch = await this.searchHistoryRepository.findOne({
      where: {
        userId,
        query: query.toLowerCase().trim(),
      },
    });

    if (existingSearch) {
      // Update existing record
      existingSearch.searchCount += 1;
      existingSearch.lastSearchedAt = new Date();
      if (filters) existingSearch.filters = filters;
      if (resultsCount !== undefined)
        existingSearch.resultsCount = resultsCount;
      return this.searchHistoryRepository.save(existingSearch);
    }

    // Create new record
    const searchHistory = this.searchHistoryRepository.create({
      userId,
      query: query.toLowerCase().trim(),
      filters: filters || null,
      resultsCount: resultsCount ?? 0,
      searchCount: 1,
      lastSearchedAt: new Date(),
    });

    return this.searchHistoryRepository.save(searchHistory);
  }

  /**
   * Get user's search history
   */
  async getSearchHistory(userId: string, limit = 20): Promise<SearchHistory[]> {
    return this.searchHistoryRepository.find({
      where: { userId },
      order: { lastSearchedAt: "DESC" },
      take: limit,
    });
  }

  /**
   * Get user's most frequent searches
   */
  async getFrequentSearches(
    userId: string,
    limit = 10,
  ): Promise<SearchHistory[]> {
    return this.searchHistoryRepository.find({
      where: { userId },
      order: { searchCount: "DESC" },
      take: limit,
    });
  }

  /**
   * Delete a search history entry
   */
  async deleteSearchHistory(userId: string, historyId: string): Promise<void> {
    await this.searchHistoryRepository.delete({
      id: historyId,
      userId,
    });
  }

  /**
   * Clear all search history for a user
   */
  async clearSearchHistory(userId: string): Promise<void> {
    await this.searchHistoryRepository.delete({ userId });
  }

  /**
   * Get trending searches (across all users)
   */
  async getTrendingSearches(
    limit = 10,
  ): Promise<{ query: string; count: number }[]> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const results = await this.searchHistoryRepository
      .createQueryBuilder("sh")
      .select("sh.query", "query")
      .addSelect("SUM(sh.searchCount)", "count")
      .where("sh.lastSearchedAt >= :oneWeekAgo", { oneWeekAgo })
      .groupBy("sh.query")
      .orderBy("count", "DESC")
      .limit(limit)
      .getRawMany();

    return results.map((r) => ({
      query: r.query,
      count: parseInt(r.count, 10),
    }));
  }
}
