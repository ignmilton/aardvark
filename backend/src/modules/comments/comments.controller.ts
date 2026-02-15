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
import { CommentsService } from "./comments.service";
import { CreateCommentDto, UpdateCommentDto, CommentQueryDto } from "./dto";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";

@ApiTags("comments")
@Controller("comments")
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a new comment" })
  @ApiResponse({ status: 201, description: "Comment created" })
  @ApiResponse({
    status: 404,
    description: "Story or parent comment not found",
  })
  async create(@Body() createDto: CreateCommentDto, @Request() req: any) {
    return this.commentsService.create(createDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: "Get comments with pagination" })
  @ApiResponse({ status: 200, description: "List of comments" })
  async findAll(@Query() query: CommentQueryDto) {
    return this.commentsService.findAll(query);
  }

  @Get("story/:storyId/threaded")
  @ApiOperation({ summary: "Get threaded comments for a story" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiResponse({ status: 200, description: "Threaded comments" })
  async getThreadedComments(
    @Param("storyId") storyId: string,
    @Query("segmentId") segmentId?: string,
    @Query("page") page = 1,
    @Query("limit") limit = 20,
  ) {
    return this.commentsService.getThreadedComments(
      storyId,
      segmentId,
      +page,
      +limit,
    );
  }

  @Get("story/:storyId/count")
  @ApiOperation({ summary: "Get comment count for a story" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiResponse({ status: 200, description: "Comment count" })
  async getCommentCount(@Param("storyId") storyId: string) {
    const count = await this.commentsService.getCommentCount(storyId);
    return { count };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get comment by ID with replies" })
  @ApiParam({ name: "id", description: "Comment ID" })
  @ApiResponse({ status: 200, description: "Comment details" })
  @ApiResponse({ status: 404, description: "Comment not found" })
  async findById(@Param("id") id: string) {
    return this.commentsService.findById(id);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a comment" })
  @ApiParam({ name: "id", description: "Comment ID" })
  @ApiResponse({ status: 200, description: "Comment updated" })
  @ApiResponse({ status: 403, description: "Not authorized to edit" })
  @ApiResponse({ status: 404, description: "Comment not found" })
  async update(
    @Param("id") id: string,
    @Body() updateDto: UpdateCommentDto,
    @Request() req: any,
  ) {
    return this.commentsService.update(id, updateDto, req.user.id);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a comment" })
  @ApiParam({ name: "id", description: "Comment ID" })
  @ApiResponse({ status: 204, description: "Comment deleted" })
  @ApiResponse({ status: 403, description: "Not authorized to delete" })
  @ApiResponse({ status: 404, description: "Comment not found" })
  async delete(@Param("id") id: string, @Request() req: any) {
    await this.commentsService.delete(id, req.user.id, req.user.role);
  }

  @Post(":id/like")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Like a comment" })
  @ApiParam({ name: "id", description: "Comment ID" })
  @ApiResponse({ status: 200, description: "Comment liked" })
  async likeComment(@Param("id") id: string, @Request() req: any) {
    await this.commentsService.likeComment(id, req.user.id);
    return { message: "Comment liked" };
  }

  @Delete(":id/like")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Unlike a comment" })
  @ApiParam({ name: "id", description: "Comment ID" })
  @ApiResponse({ status: 200, description: "Comment unliked" })
  async unlikeComment(@Param("id") id: string, @Request() req: any) {
    await this.commentsService.unlikeComment(id, req.user.id);
    return { message: "Comment unliked" };
  }
}
