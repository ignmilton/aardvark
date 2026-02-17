import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  Request,
  HttpStatus,
  HttpException,
  Res,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiResponse,
} from "@nestjs/swagger";
import { Response } from "express";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { AuthenticatedRequest } from "@/common/interfaces/authenticated-request.interface";
import { AnalyticsService } from "./analytics.service";
import {
  AnalyticsQueryDto,
  ExportAnalyticsDto,
  EngagementTrendsDto,
  TopStoriesDto,
  AnalyticsPeriod,
  ExportFormat,
} from "./dto";
import {
  AuthorDashboard,
  StoryAnalytics,
  TopStory,
  ReaderStats,
  EarningsBreakdown,
  BranchPopularity,
  CompletionFunnel,
  EngagementTrends,
} from "./analytics.types";

/**
 * Controller for analytics endpoints.
 * Provides comprehensive analytics for authors to track their story performance,
 * reader engagement, and earnings.
 */
@ApiTags("analytics")
@Controller("analytics")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Get author dashboard summary
   * Returns overall statistics including total reads, earnings, top stories, and recent activity
   */
  @Get("dashboard")
  @ApiOperation({
    summary: "Get author dashboard summary",
    description:
      "Returns comprehensive dashboard statistics including total reads, unique readers, earnings trends, top stories, and recent activity",
  })
  @ApiResponse({
    status: 200,
    description: "Dashboard data retrieved successfully",
    type: Object,
  })
  async getDashboard(
    @Request() req: AuthenticatedRequest,
  ): Promise<AuthorDashboard> {
    return this.analyticsService.getAuthorDashboard(req.user.userId);
  }

  /**
   * Get detailed analytics for a specific story
   */
  @Get("stories/:storyId")
  @ApiOperation({
    summary: "Get story-specific analytics",
    description:
      "Returns detailed analytics for a specific story including views, ratings distribution, branch heatmap, and engagement trends",
  })
  @ApiParam({
    name: "storyId",
    description: "Story UUID",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Story analytics retrieved successfully",
    type: Object,
  })
  @ApiResponse({
    status: 404,
    description: "Story not found",
  })
  @ApiResponse({
    status: 403,
    description: "You do not have access to this story",
  })
  async getStoryAnalytics(
    @Param("storyId") storyId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<StoryAnalytics> {
    return this.analyticsService.getStoryAnalytics(storyId, req.user.userId);
  }

  /**
   * Get top performing stories
   */
  @Get("top-stories")
  @ApiOperation({
    summary: "Get top performing stories",
    description:
      "Returns a list of top performing stories ordered by view count, with optional time period filtering",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Maximum number of stories to return (1-100)",
    example: 10,
  })
  @ApiQuery({
    name: "period",
    required: false,
    enum: AnalyticsPeriod,
    description: "Time period to filter by",
    example: AnalyticsPeriod.MONTH,
  })
  @ApiResponse({
    status: 200,
    description: "Top stories retrieved successfully",
    type: [Object],
  })
  async getTopStories(
    @Query() query: TopStoriesDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<TopStory[]> {
    return this.analyticsService.getTopStories(
      req.user.userId,
      query.limit,
      query.period,
    );
  }

  /**
   * Get reader engagement statistics
   */
  @Get("readers")
  @ApiOperation({
    summary: "Get reader engagement statistics",
    description:
      "Returns reader statistics including total readers, active readers, new vs returning readers, and engagement trends",
  })
  @ApiQuery({
    name: "period",
    required: false,
    enum: AnalyticsPeriod,
    description: "Time period to analyze",
    example: AnalyticsPeriod.MONTH,
  })
  @ApiResponse({
    status: 200,
    description: "Reader statistics retrieved successfully",
    type: Object,
  })
  async getReaderStats(
    @Query() query: AnalyticsQueryDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<ReaderStats> {
    return this.analyticsService.getReaderStats(req.user.userId, query.period);
  }

  /**
   * Get earnings breakdown
   */
  @Get("earnings")
  @ApiOperation({
    summary: "Get earnings breakdown",
    description:
      "Returns detailed earnings breakdown by story, transaction type, and time period",
  })
  @ApiQuery({
    name: "period",
    required: false,
    enum: AnalyticsPeriod,
    description: "Time period to analyze",
    example: AnalyticsPeriod.MONTH,
  })
  @ApiResponse({
    status: 200,
    description: "Earnings breakdown retrieved successfully",
    type: Object,
  })
  async getEarningsBreakdown(
    @Query() query: AnalyticsQueryDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<EarningsBreakdown> {
    return this.analyticsService.getEarningsBreakdown(
      req.user.userId,
      query.period,
    );
  }

  /**
   * Get branch popularity for a story
   */
  @Get("stories/:storyId/branches")
  @ApiOperation({
    summary: "Get branch popularity",
    description:
      "Returns statistics showing which story branches are most popular and how readers choose different paths",
  })
  @ApiParam({
    name: "storyId",
    description: "Story UUID",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Branch popularity data retrieved successfully",
    type: [Object],
  })
  @ApiResponse({
    status: 404,
    description: "Story not found",
  })
  @ApiResponse({
    status: 403,
    description: "You do not have access to this story",
  })
  async getBranchPopularity(
    @Param("storyId") storyId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<BranchPopularity[]> {
    return this.analyticsService.getBranchPopularity(storyId, req.user.userId);
  }

  /**
   * Get completion funnel showing reader drop-off
   */
  @Get("stories/:storyId/funnel")
  @ApiOperation({
    summary: "Get completion funnel",
    description:
      "Returns a funnel visualization showing where readers drop off in the story, helping identify problematic segments",
  })
  @ApiParam({
    name: "storyId",
    description: "Story UUID",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Completion funnel data retrieved successfully",
    type: Object,
  })
  @ApiResponse({
    status: 404,
    description: "Story not found",
  })
  @ApiResponse({
    status: 403,
    description: "You do not have access to this story",
  })
  async getCompletionFunnel(
    @Param("storyId") storyId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<CompletionFunnel> {
    return this.analyticsService.getCompletionFunnel(storyId, req.user.userId);
  }

  /**
   * Get engagement trends over time
   */
  @Get("trends")
  @ApiOperation({
    summary: "Get engagement trends",
    description:
      "Returns time-series data showing engagement trends including reads, comments, ratings, and earnings over time",
  })
  @ApiQuery({
    name: "startDate",
    required: false,
    type: String,
    description: "Start date (ISO 8601 format)",
    example: "2024-01-01",
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    type: String,
    description: "End date (ISO 8601 format)",
    example: "2024-12-31",
  })
  @ApiQuery({
    name: "days",
    required: false,
    type: Number,
    description: "Number of days to include (alternative to date range)",
    example: 30,
  })
  @ApiResponse({
    status: 200,
    description: "Engagement trends retrieved successfully",
    type: Object,
  })
  async getEngagementTrends(
    @Query() query: AnalyticsQueryDto & EngagementTrendsDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<EngagementTrends> {
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (query.endDate) {
      endDate = new Date(query.endDate);
    }

    if (query.startDate) {
      startDate = new Date(query.startDate);
    } else if (query.days) {
      // Calculate start date based on days
      endDate = endDate || new Date();
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - query.days);
    }

    return this.analyticsService.getEngagementTrends(
      req.user.userId,
      startDate,
      endDate,
    );
  }

  /**
   * Export analytics data
   */
  @Get("export")
  @ApiOperation({
    summary: "Export analytics data",
    description:
      "Export analytics data in CSV or JSON format for external analysis",
  })
  @ApiQuery({
    name: "format",
    required: true,
    enum: ExportFormat,
    description: "Export format (csv or json)",
    example: "json",
  })
  @ApiQuery({
    name: "type",
    required: false,
    enum: ["dashboard", "stories", "earnings", "readers"],
    description: "Type of analytics to export",
    example: "dashboard",
  })
  @ApiQuery({
    name: "includeStories",
    required: false,
    type: Boolean,
    description: "Include story data in export",
    example: true,
  })
  @ApiQuery({
    name: "includeEarnings",
    required: false,
    type: Boolean,
    description: "Include earnings data in export",
    example: true,
  })
  @ApiQuery({
    name: "includeReaders",
    required: false,
    type: Boolean,
    description: "Include reader data in export",
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: "Analytics data exported successfully",
  })
  async exportAnalytics(
    @Query() query: ExportAnalyticsDto & { type?: string },
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const type = query.type || "dashboard";

    // Validate type
    if (!["dashboard", "stories", "earnings", "readers"].includes(type)) {
      throw new HttpException(
        "Invalid export type. Must be one of: dashboard, stories, earnings, readers",
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.analyticsService.exportAnalytics(
      req.user.userId,
      type as "dashboard" | "stories" | "earnings" | "readers",
      query.format,
    );

    // Set response headers
    res.setHeader("Content-Type", result.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    // Send the data
    res.send(result.data);
  }
}
