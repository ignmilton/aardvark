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
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { JwtAuthGuard, OptionalJwtAuthGuard } from "@/modules/auth/guards";
import { CollectionsService } from "./collections.service";
import { AuthenticatedRequest } from "@/common/interfaces/authenticated-request.interface";
import {
  CreateCollectionDto,
  UpdateCollectionDto,
  AddStoryToCollectionDto,
  ReorderStoriesDto,
  CollectionQueryDto,
} from "./dto";

/**
 * Controller for user-curated story collections.
 * Allows users to create, manage, and follow collections.
 */
@ApiTags("collections")
@Controller("collections")
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  /**
   * List public collections with pagination and filtering
   */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "List public collections" })
  @ApiResponse({ status: 200, description: "Collections retrieved" })
  async findAll(@Query() query: CollectionQueryDto) {
    return this.collectionsService.findAll(query);
  }

  /**
   * Get current user's collections
   */
  @Get("my")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user's collections" })
  @ApiResponse({ status: 200, description: "User collections retrieved" })
  async findMine(@Request() req: AuthenticatedRequest) {
    return this.collectionsService.findMine(req.user.id);
  }

  /**
   * Get collections followed by current user
   */
  @Get("following")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get collections I follow" })
  @ApiResponse({ status: 200, description: "Followed collections retrieved" })
  async getFollowing(@Request() req: AuthenticatedRequest) {
    return this.collectionsService.getFollowedCollections(req.user.id);
  }

  /**
   * Get collections by user ID
   */
  @Get("user/:userId")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Get user's public collections" })
  @ApiParam({ name: "userId", description: "User ID" })
  @ApiResponse({ status: 200, description: "User collections retrieved" })
  async findByUser(@Param("userId") userId: string, @Request() req: AuthenticatedRequest) {
    return this.collectionsService.findByUser(userId, req.user?.id);
  }

  /**
   * Get collection by slug
   */
  @Get("slug/:slug")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Get collection by slug" })
  @ApiParam({ name: "slug", description: "Collection slug" })
  @ApiResponse({ status: 200, description: "Collection retrieved" })
  @ApiResponse({ status: 404, description: "Collection not found" })
  async findBySlug(@Param("slug") slug: string, @Request() req: AuthenticatedRequest) {
    return this.collectionsService.findBySlug(slug, req.user?.id);
  }

  /**
   * Get collection by ID
   */
  @Get(":id")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Get collection by ID" })
  @ApiParam({ name: "id", description: "Collection ID" })
  @ApiResponse({ status: 200, description: "Collection retrieved" })
  @ApiResponse({ status: 404, description: "Collection not found" })
  async findOne(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    return this.collectionsService.findOne(id, req.user?.id);
  }

  /**
   * Create a new collection
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a new collection" })
  @ApiResponse({ status: 201, description: "Collection created" })
  async create(@Request() req: AuthenticatedRequest, @Body() dto: CreateCollectionDto) {
    return this.collectionsService.create(req.user.id, dto);
  }

  /**
   * Update a collection
   */
  @Put(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a collection" })
  @ApiParam({ name: "id", description: "Collection ID" })
  @ApiResponse({ status: 200, description: "Collection updated" })
  @ApiResponse({ status: 403, description: "Not the owner" })
  @ApiResponse({ status: 404, description: "Collection not found" })
  async update(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateCollectionDto,
  ) {
    return this.collectionsService.update(id, req.user.id, dto);
  }

  /**
   * Delete a collection
   */
  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a collection" })
  @ApiParam({ name: "id", description: "Collection ID" })
  @ApiResponse({ status: 204, description: "Collection deleted" })
  @ApiResponse({ status: 403, description: "Not the owner" })
  @ApiResponse({ status: 404, description: "Collection not found" })
  async delete(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    await this.collectionsService.delete(id, req.user.id);
  }

  /**
   * Add a story to a collection
   */
  @Post(":id/stories")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Add a story to a collection" })
  @ApiParam({ name: "id", description: "Collection ID" })
  @ApiResponse({ status: 200, description: "Story added" })
  @ApiResponse({ status: 403, description: "Not the owner" })
  @ApiResponse({ status: 404, description: "Collection or story not found" })
  @ApiResponse({ status: 409, description: "Story already in collection" })
  async addStory(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: AddStoryToCollectionDto,
  ) {
    return this.collectionsService.addStory(id, req.user.id, dto);
  }

  /**
   * Remove a story from a collection
   */
  @Delete(":id/stories/:storyId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove a story from a collection" })
  @ApiParam({ name: "id", description: "Collection ID" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiResponse({ status: 204, description: "Story removed" })
  @ApiResponse({ status: 403, description: "Not the owner" })
  @ApiResponse({ status: 404, description: "Collection or story not found" })
  async removeStory(
    @Param("id") id: string,
    @Param("storyId") storyId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.collectionsService.removeStory(id, storyId, req.user.id);
  }

  /**
   * Reorder stories in a collection
   */
  @Put(":id/reorder")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Reorder stories in a collection" })
  @ApiParam({ name: "id", description: "Collection ID" })
  @ApiResponse({ status: 200, description: "Stories reordered" })
  @ApiResponse({ status: 403, description: "Not the owner" })
  @ApiResponse({ status: 404, description: "Collection not found" })
  async reorderStories(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: ReorderStoriesDto,
  ) {
    return this.collectionsService.reorderStories(
      id,
      req.user.id,
      dto.storyIds,
    );
  }

  /**
   * Follow a collection
   */
  @Post(":id/follow")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Follow a collection" })
  @ApiParam({ name: "id", description: "Collection ID" })
  @ApiResponse({ status: 201, description: "Now following" })
  @ApiResponse({ status: 403, description: "Collection is private" })
  @ApiResponse({ status: 404, description: "Collection not found" })
  @ApiResponse({ status: 409, description: "Already following" })
  async follow(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    return this.collectionsService.follow(id, req.user.id);
  }

  /**
   * Unfollow a collection
   */
  @Delete(":id/follow")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Unfollow a collection" })
  @ApiParam({ name: "id", description: "Collection ID" })
  @ApiResponse({ status: 204, description: "Unfollowed" })
  @ApiResponse({ status: 404, description: "Not following" })
  async unfollow(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    await this.collectionsService.unfollow(id, req.user.id);
  }

  /**
   * Check if following a collection
   */
  @Get(":id/following")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Check if following a collection" })
  @ApiParam({ name: "id", description: "Collection ID" })
  @ApiResponse({ status: 200, description: "Following status" })
  async isFollowing(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    const isFollowing = await this.collectionsService.isFollowing(
      id,
      req.user.id,
    );
    return { isFollowing };
  }
}
