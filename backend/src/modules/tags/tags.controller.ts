import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { TagsService } from "./tags.service";
import {
  CreateTagDto,
  UpdateTagDto,
  TagQueryDto,
  AddTagsToStoryDto,
  TagSuggestDto,
  BulkTagActionDto,
  CreateTagAliasDto,
} from "./dto";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/modules/auth/guards/roles.guard";
import { Roles } from "@/modules/auth/decorators/roles.decorator";
import { UserRole } from "@aardvark/shared";
import { Public } from "@/modules/auth/decorators/public.decorator";

@ApiTags("tags")
@Controller("tags")
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  // ============================================================================
  // Public Endpoints
  // ============================================================================

  @Public()
  @Get()
  @ApiOperation({ summary: "Get all tags with filtering" })
  @ApiResponse({ status: 200, description: "Tags retrieved successfully" })
  async findAll(@Query() query: TagQueryDto) {
    return this.tagsService.findAll(query);
  }

  @Public()
  @Get("popular")
  @ApiOperation({ summary: "Get popular and trending tags" })
  @ApiResponse({ status: 200, description: "Popular tags retrieved" })
  async getPopular() {
    return this.tagsService.getPopularTags();
  }

  @Public()
  @Get("suggest")
  @ApiOperation({ summary: "Tag autocomplete suggestions" })
  @ApiResponse({ status: 200, description: "Suggestions retrieved" })
  async suggest(@Query() dto: TagSuggestDto) {
    return this.tagsService.suggest(dto);
  }

  @Public()
  @Get("by-type")
  @ApiOperation({ summary: "Get tags grouped by type" })
  @ApiResponse({ status: 200, description: "Tags grouped by type" })
  async getByType() {
    return this.tagsService.getTagsByType();
  }

  @Public()
  @Get(":idOrSlug")
  @ApiOperation({ summary: "Get tag by ID or slug" })
  @ApiParam({ name: "idOrSlug", description: "Tag ID or slug" })
  @ApiResponse({ status: 200, description: "Tag retrieved" })
  @ApiResponse({ status: 404, description: "Tag not found" })
  async findOne(@Param("idOrSlug") idOrSlug: string) {
    return this.tagsService.findOneWithStats(idOrSlug);
  }

  @Public()
  @Get(":idOrSlug/stories")
  @ApiOperation({ summary: "Get stories with this tag" })
  @ApiParam({ name: "idOrSlug", description: "Tag ID or slug" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Stories retrieved" })
  async getStoriesByTag(
    @Param("idOrSlug") idOrSlug: string,
    @Query("page") page = 1,
    @Query("limit") limit = 20,
  ) {
    return this.tagsService.getStoriesByTag(idOrSlug, +page, +limit);
  }

  // ============================================================================
  // Authenticated User Endpoints
  // ============================================================================

  @UseGuards(JwtAuthGuard)
  @Post("stories/:storyId")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Add tags to a story" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiResponse({ status: 201, description: "Tags added successfully" })
  @ApiResponse({ status: 404, description: "Story or tags not found" })
  async addTagsToStory(
    @Param("storyId") storyId: string,
    @Body() dto: AddTagsToStoryDto,
    @Request() req: any,
  ) {
    return this.tagsService.addTagsToStory(storyId, dto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("stories/:storyId/:tagId")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Remove a tag from a story" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiParam({ name: "tagId", description: "Tag ID" })
  @ApiResponse({ status: 200, description: "Tag removed" })
  async removeTagFromStory(
    @Param("storyId") storyId: string,
    @Param("tagId") tagId: string,
  ) {
    await this.tagsService.removeTagFromStory(storyId, tagId);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get("stories/:storyId/tags")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get all tags for a story" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiResponse({ status: 200, description: "Story tags retrieved" })
  async getStoryTags(@Param("storyId") storyId: string) {
    return this.tagsService.getStoryTags(storyId);
  }

  // ============================================================================
  // Moderator/Admin Endpoints
  // ============================================================================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a new tag (moderator+)" })
  @ApiResponse({ status: 201, description: "Tag created successfully" })
  @ApiResponse({ status: 409, description: "Tag already exists" })
  async create(@Body() createDto: CreateTagDto) {
    return this.tagsService.create(createDto, true);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @Patch(":id")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a tag (moderator+)" })
  @ApiParam({ name: "id", description: "Tag ID" })
  @ApiResponse({ status: 200, description: "Tag updated" })
  @ApiResponse({ status: 404, description: "Tag not found" })
  async update(@Param("id") id: string, @Body() updateDto: UpdateTagDto) {
    return this.tagsService.update(id, updateDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(":id")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a tag (admin only)" })
  @ApiParam({ name: "id", description: "Tag ID" })
  @ApiResponse({ status: 200, description: "Tag deleted" })
  @ApiResponse({ status: 404, description: "Tag not found" })
  async delete(@Param("id") id: string) {
    await this.tagsService.delete(id);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post("bulk")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Bulk tag operations (admin only)" })
  @ApiResponse({ status: 200, description: "Bulk action completed" })
  async bulkAction(@Body() dto: BulkTagActionDto) {
    return this.tagsService.bulkAction(dto);
  }

  // ============================================================================
  // Tag Alias Endpoints
  // ============================================================================

  @Public()
  @Get(":id/aliases")
  @ApiOperation({ summary: "Get all aliases for a tag" })
  @ApiParam({ name: "id", description: "Tag ID" })
  @ApiResponse({ status: 200, description: "Aliases retrieved" })
  @ApiResponse({ status: 404, description: "Tag not found" })
  async getAliases(@Param("id") id: string) {
    const aliases = await this.tagsService.getTagAliases(id);
    return { success: true, data: aliases };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @Post(":id/aliases")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Add an alias to a tag (moderator+)" })
  @ApiParam({ name: "id", description: "Tag ID" })
  @ApiResponse({ status: 201, description: "Alias added successfully" })
  @ApiResponse({ status: 404, description: "Tag not found" })
  @ApiResponse({ status: 409, description: "Alias already exists" })
  async addAlias(@Param("id") id: string, @Body() dto: CreateTagAliasDto) {
    const alias = await this.tagsService.addTagAlias(id, dto);
    return { success: true, data: alias };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @Delete(":id/aliases/:aliasId")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Remove an alias from a tag (moderator+)" })
  @ApiParam({ name: "id", description: "Tag ID" })
  @ApiParam({ name: "aliasId", description: "Alias ID" })
  @ApiResponse({ status: 200, description: "Alias removed" })
  @ApiResponse({ status: 404, description: "Alias not found" })
  async removeAlias(
    @Param("id") id: string,
    @Param("aliasId") aliasId: string,
  ) {
    await this.tagsService.removeTagAlias(id, aliasId);
    return { success: true };
  }
}
