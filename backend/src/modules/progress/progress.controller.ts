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
import { ProgressService } from "./progress.service";
import {
  StartReadingDto,
  MakeChoiceDto,
  AddBookmarkDto,
  UpdateBookmarkDto,
} from "./dto";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { AuthenticatedRequest } from "@/common/interfaces/authenticated-request.interface";

@ApiTags("progress")
@Controller("progress")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post("start")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Start reading a story or resume existing progress",
  })
  @ApiResponse({ status: 200, description: "Reading started/resumed" })
  @ApiResponse({ status: 404, description: "Story not found" })
  async startReading(
    @Body() dto: StartReadingDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.progressService.startReading(req.user.id, dto);
  }

  @Get("me")
  @ApiOperation({ summary: "Get all reading progress for current user" })
  @ApiQuery({ name: "isCompleted", required: false, type: Boolean })
  @ApiResponse({ status: 200, description: "List of reading progress" })
  async getUserProgress(
    @Request() req: AuthenticatedRequest,
    @Query("isCompleted") isCompleted?: string,
  ) {
    const completed =
      isCompleted === "true"
        ? true
        : isCompleted === "false"
          ? false
          : undefined;
    return this.progressService.getUserProgress(req.user.id, completed);
  }

  @Get("me/stats")
  @ApiOperation({ summary: "Get reading statistics for current user" })
  @ApiResponse({ status: 200, description: "User reading statistics" })
  async getUserStats(@Request() req: AuthenticatedRequest) {
    return this.progressService.getUserReadingStats(req.user.id);
  }

  @Get("story/:storyId")
  @ApiOperation({ summary: "Get progress for a specific story" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiResponse({ status: 200, description: "Reading progress" })
  @ApiResponse({ status: 404, description: "No progress found" })
  async getProgress(
    @Param("storyId") storyId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const progress = await this.progressService.getProgress(
      req.user.id,
      storyId,
    );
    if (!progress) {
      return { started: false };
    }
    return { started: true, progress };
  }

  @Post("story/:storyId/choice")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Make a choice and navigate to next segment" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiResponse({ status: 200, description: "Choice made, progress updated" })
  @ApiResponse({ status: 400, description: "Invalid choice" })
  @ApiResponse({ status: 404, description: "Progress or choice not found" })
  async makeChoice(
    @Param("storyId") storyId: string,
    @Body() dto: MakeChoiceDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.progressService.makeChoice(req.user.id, storyId, dto);
  }

  @Post("story/:storyId/navigate/:segmentId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Navigate to a previously visited segment (backtrack)",
  })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiParam({ name: "segmentId", description: "Target segment ID" })
  @ApiResponse({ status: 200, description: "Navigation successful" })
  @ApiResponse({
    status: 400,
    description: "Cannot navigate to unvisited segment",
  })
  async navigateToSegment(
    @Param("storyId") storyId: string,
    @Param("segmentId") segmentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.progressService.navigateToSegment(
      req.user.id,
      storyId,
      segmentId,
    );
  }

  @Post("story/:storyId/reset")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset progress to start story over" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiResponse({ status: 200, description: "Progress reset" })
  @ApiResponse({ status: 404, description: "Progress not found" })
  async resetProgress(
    @Param("storyId") storyId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.progressService.resetProgress(req.user.id, storyId);
  }

  @Delete("story/:storyId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete all progress for a story" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiResponse({ status: 204, description: "Progress deleted" })
  @ApiResponse({ status: 404, description: "Progress not found" })
  async deleteProgress(
    @Param("storyId") storyId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.progressService.deleteProgress(req.user.id, storyId);
  }

  // Bookmarks

  @Post("story/:storyId/bookmarks")
  @ApiOperation({ summary: "Add a bookmark" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiResponse({ status: 201, description: "Bookmark added" })
  @ApiResponse({ status: 409, description: "Bookmark already exists" })
  async addBookmark(
    @Param("storyId") storyId: string,
    @Body() dto: AddBookmarkDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.progressService.addBookmark(req.user.id, storyId, dto);
  }

  @Put("story/:storyId/bookmarks/:segmentId")
  @ApiOperation({ summary: "Update a bookmark note" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiParam({ name: "segmentId", description: "Bookmarked segment ID" })
  @ApiResponse({ status: 200, description: "Bookmark updated" })
  @ApiResponse({ status: 404, description: "Bookmark not found" })
  async updateBookmark(
    @Param("storyId") storyId: string,
    @Param("segmentId") segmentId: string,
    @Body() dto: UpdateBookmarkDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.progressService.updateBookmark(
      req.user.id,
      storyId,
      segmentId,
      dto,
    );
  }

  @Delete("story/:storyId/bookmarks/:segmentId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove a bookmark" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiParam({ name: "segmentId", description: "Bookmarked segment ID" })
  @ApiResponse({ status: 200, description: "Bookmark removed" })
  @ApiResponse({ status: 404, description: "Bookmark not found" })
  async removeBookmark(
    @Param("storyId") storyId: string,
    @Param("segmentId") segmentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.progressService.removeBookmark(req.user.id, storyId, segmentId);
  }
}
