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
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard, OptionalJwtAuthGuard } from "@/modules/auth/guards";
import { AuthenticatedRequest } from "@/common/interfaces/authenticated-request.interface";
import { ReadingListsService } from "./reading-lists.service";
import {
  CreateReadingListDto,
  UpdateReadingListDto,
  AddStoryToListDto,
} from "./dto/reading-lists.dto";

@ApiTags("reading-lists")
@Controller("reading-lists")
export class ReadingListsController {
  constructor(private readonly readingListsService: ReadingListsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a new reading list" })
  @ApiResponse({ status: 201, description: "Reading list created" })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateReadingListDto,
  ) {
    return this.readingListsService.create(req.user.id, dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get my reading lists" })
  @ApiResponse({ status: 200, description: "User reading lists" })
  async getMyLists(@Request() req: AuthenticatedRequest) {
    return this.readingListsService.getUserLists(req.user.id, req.user.id);
  }

  @Get("followed")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get reading lists I follow" })
  @ApiResponse({ status: 200, description: "Followed reading lists" })
  async getFollowedLists(@Request() req: AuthenticatedRequest) {
    return this.readingListsService.getFollowedLists(req.user.id);
  }

  @Get("popular")
  @ApiOperation({ summary: "Get popular public reading lists" })
  @ApiResponse({ status: 200, description: "Popular reading lists" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async getPopularLists(@Query("limit") limit?: number) {
    return this.readingListsService.getPopularLists(limit || 10);
  }

  @Get("user/:userId")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Get user's public reading lists" })
  @ApiResponse({ status: 200, description: "User reading lists" })
  @ApiParam({ name: "userId", description: "User ID" })
  async getUserLists(
    @Param("userId") userId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.readingListsService.getUserLists(userId, req.user?.id);
  }

  @Get(":id")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Get a reading list by ID" })
  @ApiResponse({ status: 200, description: "Reading list details" })
  @ApiParam({ name: "id", description: "Reading list ID" })
  async getById(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    return this.readingListsService.getById(id, req.user?.id);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a reading list" })
  @ApiResponse({ status: 200, description: "Reading list updated" })
  @ApiParam({ name: "id", description: "Reading list ID" })
  async update(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateReadingListDto,
  ) {
    return this.readingListsService.update(id, req.user.id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a reading list" })
  @ApiResponse({ status: 204, description: "Reading list deleted" })
  @ApiParam({ name: "id", description: "Reading list ID" })
  async delete(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    await this.readingListsService.delete(id, req.user.id);
  }

  @Post(":id/stories")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Add a story to reading list" })
  @ApiResponse({ status: 200, description: "Story added to list" })
  @ApiParam({ name: "id", description: "Reading list ID" })
  async addStory(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: AddStoryToListDto,
  ) {
    return this.readingListsService.addStory(id, dto.storyId, req.user.id);
  }

  @Delete(":id/stories/:storyId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove a story from reading list" })
  @ApiResponse({ status: 204, description: "Story removed from list" })
  @ApiParam({ name: "id", description: "Reading list ID" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  async removeStory(
    @Param("id") id: string,
    @Param("storyId") storyId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.readingListsService.removeStory(id, storyId, req.user.id);
  }

  @Post(":id/follow")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Follow a reading list" })
  @ApiResponse({ status: 201, description: "Now following list" })
  @ApiParam({ name: "id", description: "Reading list ID" })
  async follow(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    return this.readingListsService.follow(id, req.user.id);
  }

  @Delete(":id/follow")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Unfollow a reading list" })
  @ApiResponse({ status: 204, description: "Unfollowed list" })
  @ApiParam({ name: "id", description: "Reading list ID" })
  async unfollow(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.readingListsService.unfollow(id, req.user.id);
  }

  @Get(":id/following")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Check if following a reading list" })
  @ApiResponse({ status: 200, description: "Following status" })
  @ApiParam({ name: "id", description: "Reading list ID" })
  async isFollowing(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const isFollowing = await this.readingListsService.isFollowing(
      id,
      req.user.id,
    );
    return { isFollowing };
  }
}
