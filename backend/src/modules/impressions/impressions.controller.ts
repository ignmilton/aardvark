import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  Headers,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { JwtAuthGuard, OptionalJwtAuthGuard } from "@/modules/auth/guards";
import { RolesGuard } from "@/modules/auth/guards/roles.guard";
import { Roles } from "@/modules/auth/decorators/roles.decorator";
import { UserRole } from "@aardvark/shared";
import { ImpressionsService } from "./impressions.service";
import {
  RecordImpressionDto,
  ImpressionQueryDto,
  RevenueQueryDto,
  CalculateRevenueDto,
} from "./dto";

/**
 * Controller for impression tracking and revenue management.
 * Tracks story views/reads for analytics and author revenue sharing.
 */
@ApiTags("impressions")
@Controller("impressions")
export class ImpressionsController {
  constructor(private readonly impressionsService: ImpressionsService) {}

  /**
   * Record a new impression
   * Can be called by authenticated or anonymous users
   */
  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Record a story impression (view/read)" })
  @ApiResponse({ status: 201, description: "Impression recorded" })
  async recordImpression(
    @Body() dto: RecordImpressionDto,
    @Request() req: any,
    @Headers("user-agent") userAgent?: string,
    @Headers("x-forwarded-for") forwardedFor?: string,
    @Headers("x-real-ip") realIp?: string,
  ) {
    const userId = req.user?.id;
    const ipAddress = forwardedFor?.split(",")[0] || realIp || req.ip;

    const impression = await this.impressionsService.recordImpression(
      dto,
      userId,
      { userAgent, ipAddress },
    );

    return {
      success: true,
      data: {
        id: impression.id,
        type: impression.type,
        isRevenueEligible: impression.isRevenueEligible,
      },
    };
  }

  /**
   * Get impression statistics for a story (author only)
   */
  @Get("story/:storyId/stats")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get impression stats for a story" })
  @ApiParam({ name: "storyId", description: "Story ID" })
  @ApiResponse({ status: 200, description: "Stats retrieved" })
  async getStoryStats(
    @Param("storyId") storyId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const stats = await this.impressionsService.getStoryStats(
      storyId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    return { success: true, data: stats };
  }

  /**
   * Get author's revenue records
   */
  @Get("revenue")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get author revenue records" })
  @ApiResponse({ status: 200, description: "Revenue records retrieved" })
  async getRevenue(@Request() req: any, @Query() query: RevenueQueryDto) {
    return this.impressionsService.getAuthorRevenue(req.user.id, query);
  }

  /**
   * Get revenue summary for author dashboard
   */
  @Get("revenue/summary")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get revenue summary for dashboard" })
  @ApiResponse({ status: 200, description: "Summary retrieved" })
  async getRevenueSummary(@Request() req: any) {
    const summary = await this.impressionsService.getRevenueSummary(
      req.user.id,
    );
    return { success: true, data: summary };
  }

  /**
   * Get all impressions (admin)
   */
  @Get("admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get all impressions (admin)" })
  @ApiResponse({ status: 200, description: "Impressions retrieved" })
  async getImpressions(@Query() query: ImpressionQueryDto) {
    return this.impressionsService.getImpressions(query);
  }

  /**
   * Calculate revenue for a period (admin)
   * This should typically be run by a scheduled job
   */
  @Post("revenue/calculate")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Calculate revenue for a period (admin)" })
  @ApiResponse({ status: 200, description: "Revenue calculated" })
  async calculateRevenue(@Body() dto: CalculateRevenueDto) {
    const result = await this.impressionsService.calculateRevenue(
      new Date(dto.periodStart),
      new Date(dto.periodEnd),
      dto.totalRevenuePool || 0,
    );

    return {
      success: true,
      data: {
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        totalRevenuePool: result.totalRevenuePool,
        totalImpressions: result.totalImpressions,
        storiesProcessed: result.storiesProcessed,
      },
    };
  }
}
