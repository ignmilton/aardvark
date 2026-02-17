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
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { ForumService } from "./forum.service";
import {
  CreateThreadDto,
  UpdateThreadDto,
  CreatePostDto,
  UpdatePostDto,
  VotePostDto,
  ThreadQueryDto,
  PostQueryDto,
  PinThreadDto,
} from "./dto";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { AuthenticatedRequest } from "@/common/interfaces/authenticated-request.interface";
import { UserRole } from "@aardvark/shared";

@ApiTags("forum")
@Controller("forum")
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  // ============================================================================
  // Categories
  // ============================================================================

  @Get("categories")
  @ApiOperation({ summary: "Get all forum categories with stats" })
  @ApiResponse({
    status: 200,
    description: "List of categories with statistics",
  })
  async getCategories() {
    return this.forumService.getCategories();
  }

  // ============================================================================
  // Threads
  // ============================================================================

  @Get("threads")
  @ApiOperation({ summary: "Get threads with pagination and filtering" })
  @ApiResponse({ status: 200, description: "List of threads" })
  async getThreads(@Query() query: ThreadQueryDto) {
    return this.forumService.getThreads(query);
  }

  @Get("threads/:id")
  @ApiOperation({ summary: "Get thread details by ID" })
  @ApiParam({ name: "id", description: "Thread ID" })
  @ApiResponse({ status: 200, description: "Thread details" })
  @ApiResponse({ status: 404, description: "Thread not found" })
  async getThread(@Param("id") id: string) {
    return this.forumService.getThread(id);
  }

  @Post("threads")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a new thread" })
  @ApiResponse({ status: 201, description: "Thread created" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async createThread(@Body() dto: CreateThreadDto, @Request() req: AuthenticatedRequest) {
    return this.forumService.createThread(req.user.id, dto);
  }

  @Patch("threads/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a thread (author only)" })
  @ApiParam({ name: "id", description: "Thread ID" })
  @ApiResponse({ status: 200, description: "Thread updated" })
  @ApiResponse({ status: 403, description: "Not authorized to edit" })
  @ApiResponse({ status: 404, description: "Thread not found" })
  async updateThread(
    @Param("id") id: string,
    @Body() dto: UpdateThreadDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.forumService.updateThread(req.user.id, id, dto);
  }

  @Delete("threads/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a thread (author or moderator)" })
  @ApiParam({ name: "id", description: "Thread ID" })
  @ApiResponse({ status: 204, description: "Thread deleted" })
  @ApiResponse({ status: 403, description: "Not authorized to delete" })
  @ApiResponse({ status: 404, description: "Thread not found" })
  async deleteThread(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    await this.forumService.deleteThread(req.user.id, id, req.user.role);
  }

  @Post("threads/:id/lock")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Lock a thread (moderators only)" })
  @ApiParam({ name: "id", description: "Thread ID" })
  @ApiResponse({ status: 200, description: "Thread locked" })
  @ApiResponse({ status: 403, description: "Not authorized (moderators only)" })
  @ApiResponse({ status: 404, description: "Thread not found" })
  async lockThread(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    const userRole = req.user.role;
    if (userRole !== UserRole.MODERATOR && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException("Only moderators can lock threads");
    }
    return this.forumService.lockThread(id, req.user.id);
  }

  @Post("threads/:id/pin")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Pin or unpin a thread (moderators only)" })
  @ApiParam({ name: "id", description: "Thread ID" })
  @ApiResponse({ status: 200, description: "Thread pin status updated" })
  @ApiResponse({ status: 403, description: "Not authorized (moderators only)" })
  @ApiResponse({ status: 404, description: "Thread not found" })
  async pinThread(
    @Param("id") id: string,
    @Body() dto: PinThreadDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userRole = req.user.role;
    if (userRole !== UserRole.MODERATOR && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException("Only moderators can pin threads");
    }
    return this.forumService.pinThread(id, req.user.id, dto.isPinned);
  }

  // ============================================================================
  // Posts
  // ============================================================================

  @Get("threads/:id/posts")
  @ApiOperation({ summary: "Get posts for a thread" })
  @ApiParam({ name: "id", description: "Thread ID" })
  @ApiResponse({ status: 200, description: "List of posts" })
  @ApiResponse({ status: 404, description: "Thread not found" })
  async getPosts(@Param("id") id: string, @Query() query: PostQueryDto) {
    return this.forumService.getPosts(id, query);
  }

  @Post("threads/:id/posts")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a post/reply in a thread" })
  @ApiParam({ name: "id", description: "Thread ID" })
  @ApiResponse({ status: 201, description: "Post created" })
  @ApiResponse({ status: 400, description: "Thread is locked or invalid data" })
  @ApiResponse({ status: 404, description: "Thread not found" })
  async createPost(
    @Param("id") id: string,
    @Body() dto: CreatePostDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.forumService.createPost(req.user.id, id, dto);
  }

  @Patch("posts/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a post (author only)" })
  @ApiParam({ name: "id", description: "Post ID" })
  @ApiResponse({ status: 200, description: "Post updated" })
  @ApiResponse({ status: 403, description: "Not authorized to edit" })
  @ApiResponse({ status: 404, description: "Post not found" })
  async updatePost(
    @Param("id") id: string,
    @Body() dto: UpdatePostDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.forumService.updatePost(req.user.id, id, dto);
  }

  @Delete("posts/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a post (author or moderator)" })
  @ApiParam({ name: "id", description: "Post ID" })
  @ApiResponse({ status: 204, description: "Post deleted" })
  @ApiResponse({ status: 403, description: "Not authorized to delete" })
  @ApiResponse({ status: 404, description: "Post not found" })
  async deletePost(@Param("id") id: string, @Request() req: AuthenticatedRequest) {
    await this.forumService.deletePost(req.user.id, id, req.user.role);
  }

  @Post("posts/:id/vote")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Vote on a post (upvote/downvote)" })
  @ApiParam({ name: "id", description: "Post ID" })
  @ApiResponse({ status: 200, description: "Vote recorded" })
  @ApiResponse({ status: 404, description: "Post not found" })
  async votePost(
    @Param("id") id: string,
    @Body() dto: VotePostDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.forumService.votePost(req.user.id, id, dto.value);
  }

  // ============================================================================
  // User Reputation
  // ============================================================================

  @Get("users/:id/reputation")
  @ApiOperation({ summary: "Get user reputation and forum statistics" })
  @ApiParam({ name: "id", description: "User ID" })
  @ApiResponse({ status: 200, description: "User reputation" })
  async getUserReputation(@Param("id") id: string) {
    return this.forumService.getUserReputation(id);
  }
}
