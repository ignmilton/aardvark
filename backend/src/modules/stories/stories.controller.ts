import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/modules/auth/guards/roles.guard";
import { BanCheckGuard } from "@/modules/auth/guards/ban-check.guard";
import { Public } from "@/modules/auth/decorators/public.decorator";
import { Roles } from "@/modules/auth/decorators/roles.decorator";
import { AuthenticatedRequest } from "@/common/interfaces/authenticated-request.interface";
import { StoriesService } from "./stories.service";
import { RecommendationService } from "./recommendation.service";
import {
  CreateStoryDto,
  UpdateStoryDto,
  StoryQueryParams,
  UserRole,
} from "@aardvark/shared";

/**
 * Controller for story CRUD operations and queries.
 */
@ApiTags("stories")
@Controller("stories")
export class StoriesController {
  constructor(
    private readonly storiesService: StoriesService,
    private readonly recommendationService: RecommendationService,
  ) {}

  /**
   * Create a new story
   * Only users with AUTHOR, MODERATOR, or ADMIN role can create stories
   * Banned users are prevented from creating stories
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, BanCheckGuard)
  @Roles(UserRole.AUTHOR, UserRole.MODERATOR, UserRole.ADMIN)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Create a new story (authors only)" })
  create(
    @Request() req: AuthenticatedRequest,
    @Body() createDto: CreateStoryDto,
  ) {
    return this.storiesService.create(req.user.userId, createDto);
  }

  /**
   * Get all stories with filtering and pagination
   */
  @Get()
  @Public()
  @ApiOperation({ summary: "Get stories with filters" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "sortBy", required: false })
  findAll(@Query() query: StoryQueryParams) {
    return this.storiesService.findAll(query);
  }

  /**
   * Get featured stories
   */
  @Get("featured")
  @Public()
  @ApiOperation({ summary: "Get featured stories" })
  findFeatured(@Query("limit") limit?: number) {
    return this.storiesService.findFeatured(limit);
  }

  /**
   * Get trending stories
   */
  @Get("trending")
  @Public()
  @ApiOperation({ summary: "Get trending stories" })
  findTrending(@Query("limit") limit?: number) {
    return this.storiesService.findTrending(limit);
  }

  /**
   * Get popular stories (all-time)
   */
  @Get("popular")
  @Public()
  @ApiOperation({ summary: "Get popular stories" })
  findPopular(@Query("limit") limit?: number) {
    return this.recommendationService.getPopularStories(limit || 10);
  }

  /**
   * Get personalized recommendations for authenticated user
   */
  @Get("recommendations")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Get personalized story recommendations" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getRecommendations(
    @Request() req: AuthenticatedRequest,
    @Query("limit") limit?: number,
  ) {
    return this.recommendationService.getRecommendations(
      req.user.userId,
      limit || 10,
    );
  }

  /**
   * Get stories from followed authors
   */
  @Get("following")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Get stories from followed authors" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getFollowingStories(
    @Request() req: AuthenticatedRequest,
    @Query("limit") limit?: number,
  ) {
    return this.recommendationService.getStoriesFromFollowedAuthors(
      req.user.userId,
      limit || 10,
    );
  }

  /**
   * Get similar stories to a given story
   */
  @Get(":id/similar")
  @Public()
  @ApiOperation({ summary: "Get similar stories" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getSimilarStories(@Param("id") id: string, @Query("limit") limit?: number) {
    return this.recommendationService.getSimilarStories(id, limit || 5);
  }

  /**
   * Record a user interaction for recommendation refinement
   */
  @Post(":id/interact")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Record story interaction for recommendations" })
  async recordInteraction(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
    @Body() body: { type: "view" | "read" | "rate" | "bookmark" },
  ) {
    await this.recommendationService.recordInteraction(
      req.user.userId,
      id,
      body.type,
    );
    return { success: true };
  }

  /**
   * Get a story by slug
   */
  @Get("slug/:slug")
  @Public()
  @ApiOperation({ summary: "Get story by slug" })
  findBySlug(@Param("slug") slug: string) {
    return this.storiesService.findBySlugOrId(slug);
  }

  /**
   * Get a single story by ID
   */
  @Get(":id")
  @Public()
  @ApiOperation({ summary: "Get story by ID" })
  findOne(@Param("id") id: string) {
    return this.storiesService.findOne(id);
  }

  /**
   * Update a story
   * Banned users are prevented from updating stories
   */
  @Put(":id")
  @UseGuards(JwtAuthGuard, BanCheckGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Update a story" })
  update(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
    @Body() updateDto: UpdateStoryDto,
  ) {
    return this.storiesService.update(
      id,
      req.user.userId,
      req.user.role,
      updateDto,
    );
  }

  /**
   * Delete a story
   * Banned users are prevented from deleting stories
   */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, BanCheckGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Delete a story" })
  remove(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    return this.storiesService.remove(id, req.user.userId, req.user.role);
  }

  /**
   * Publish a story (bypasses moderation - for backwards compatibility)
   * Banned users are prevented from publishing stories
   */
  @Post(":id/publish")
  @UseGuards(JwtAuthGuard, BanCheckGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Publish a story directly (bypasses moderation)" })
  publish(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    return this.storiesService.publish(id, req.user.userId);
  }

  /**
   * Submit a story for moderation review
   * This is the recommended workflow for publishing stories
   */
  @Post(":id/submit-review")
  @UseGuards(JwtAuthGuard, BanCheckGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Submit a story for moderation review" })
  submitForReview(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.storiesService.submitForReview(id, req.user.userId);
  }

  /**
   * Get published story slugs for sitemap generation
   */
  @Get("sitemap")
  @Public()
  @ApiOperation({ summary: "Get story slugs for sitemap" })
  async getSitemapData() {
    return this.storiesService.getSitemapData();
  }

  // ============================================================================
  // Translations API
  // ============================================================================

  /**
   * Get all translations of a story
   */
  @Get(":id/translations")
  @Public()
  @ApiOperation({ summary: "Get all translations of a story" })
  getTranslations(@Param("id") id: string) {
    return this.storiesService.getTranslations(id);
  }

  /**
   * Link a story as a translation of another story
   */
  @Post(":id/translations")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Link this story as a translation of another story",
  })
  createTranslation(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
    @Body() body: { originalStoryId: string },
  ) {
    return this.storiesService.createTranslationLink(
      id,
      body.originalStoryId,
      req.user.userId,
      req.user.role,
    );
  }

  /**
   * Remove translation link from a story
   */
  @Delete(":id/translations")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Remove translation link from a story" })
  removeTranslation(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.storiesService.removeTranslationLink(
      id,
      req.user.userId,
      req.user.role,
    );
  }
}
