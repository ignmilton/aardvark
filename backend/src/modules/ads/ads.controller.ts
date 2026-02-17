import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AdsService } from "./ads.service";
import { RecordAdRewardDto } from "./dto";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { Public } from "@/modules/auth/decorators/public.decorator";
import { AuthenticatedRequest } from "@/common/interfaces/authenticated-request.interface";

@ApiTags("ads")
@Controller("ads")
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  /**
   * Get ad configuration for client
   * GET /ads/config
   */
  @Public()
  @Get("config")
  @ApiOperation({ summary: "Get ad configuration" })
  @ApiResponse({ status: 200, description: "Ad configuration retrieved" })
  getConfig() {
    const config = this.adsService.getConfig();
    return {
      success: true,
      data: config,
    };
  }

  /**
   * Get daily ad limit status
   * GET /ads/daily-limit
   */
  @UseGuards(JwtAuthGuard)
  @Get("daily-limit")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get daily ad limit status" })
  @ApiResponse({ status: 200, description: "Daily limit status retrieved" })
  async getDailyLimit(@Req() req: AuthenticatedRequest) {
    const status = await this.adsService.getDailyLimit(req.user.id);
    return {
      success: true,
      data: status,
    };
  }

  /**
   * Record an ad watch and award credits
   * POST /ads/reward
   */
  @UseGuards(JwtAuthGuard)
  @Post("reward")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Record ad watch and award credits" })
  @ApiResponse({ status: 201, description: "Credits awarded successfully" })
  @ApiResponse({
    status: 400,
    description: "Daily limit reached or cooldown active",
  })
  async recordReward(@Req() req: AuthenticatedRequest, @Body() dto: RecordAdRewardDto) {
    // Get IP address from request
    const ipAddress = req.ip || req.connection?.remoteAddress || undefined;

    const result = await this.adsService.recordAdReward(
      req.user.id,
      dto,
      ipAddress,
    );

    return result;
  }

  /**
   * Get ad reward history
   * GET /ads/history
   */
  @UseGuards(JwtAuthGuard)
  @Get("history")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get ad reward history" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Reward history retrieved" })
  async getHistory(
    @Req() req: AuthenticatedRequest,
    @Query("page") page = 1,
    @Query("limit") limit = 20,
  ) {
    const history = await this.adsService.getRewardHistory(
      req.user.id,
      +page,
      +limit,
    );

    return {
      success: true,
      ...history,
    };
  }
}
