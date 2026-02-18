import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { AuthenticatedRequest } from "@/common/interfaces/authenticated-request.interface";
import { MobileService } from "./mobile.service";
import {
  RegisterPushTokenDto,
  SyncRequestDto,
  SyncProgressDto,
  VerifyIosReceiptDto,
  VerifyAndroidReceiptDto,
} from "./dto";

/**
 * Controller for mobile-specific API endpoints.
 * Handles offline sync, push notifications, and mobile subscription verification.
 */
@ApiTags("mobile")
@Controller("mobile")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

  // ============================================================================
  // Offline Sync
  // ============================================================================

  /**
   * Sync reading progress from server
   * Used to get updates since last sync for offline reading
   */
  @Get("sync")
  @ApiOperation({ summary: "Get updates since last sync for offline reading" })
  @ApiResponse({ status: 200, description: "Sync data retrieved" })
  async getSync(
    @Request() req: AuthenticatedRequest,
    @Query() query: SyncRequestDto,
  ) {
    return this.mobileService.syncProgress(req.user.id, query);
  }

  /**
   * Upload offline reading progress to server
   * Used to sync progress made while offline
   */
  @Post("sync")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Upload offline reading progress" })
  @ApiResponse({ status: 200, description: "Progress synced" })
  async uploadSync(
    @Request() req: AuthenticatedRequest,
    @Body() dto: SyncProgressDto,
  ) {
    return this.mobileService.uploadProgress(req.user.id, dto.progress);
  }

  // ============================================================================
  // Push Notifications
  // ============================================================================

  /**
   * Register a push notification token
   */
  @Post("push-token")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Register push notification token" })
  @ApiResponse({ status: 200, description: "Token registered" })
  async registerPushToken(
    @Request() req: AuthenticatedRequest,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.mobileService.registerPushToken(req.user.id, dto);
  }

  /**
   * Unregister a push notification token
   */
  @Delete("push-token")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Unregister push notification token" })
  @ApiResponse({ status: 200, description: "Token unregistered" })
  async unregisterPushToken(
    @Request() req: AuthenticatedRequest,
    @Body() body: { token: string },
  ) {
    return this.mobileService.unregisterPushToken(req.user.id, body.token);
  }

  /**
   * Get push notification settings
   */
  @Get("push-settings")
  @ApiOperation({ summary: "Get push notification settings" })
  @ApiResponse({ status: 200, description: "Settings retrieved" })
  async getPushSettings(@Request() req: AuthenticatedRequest) {
    return this.mobileService.getPushSettings(req.user.id);
  }

  // ============================================================================
  // Mobile Subscription Verification
  // ============================================================================

  /**
   * Verify iOS App Store receipt
   */
  @Post("verify-ios")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: "Verify iOS App Store receipt" })
  @ApiResponse({ status: 200, description: "Verification result" })
  async verifyIosReceipt(
    @Request() req: AuthenticatedRequest,
    @Body() dto: VerifyIosReceiptDto,
  ) {
    return this.mobileService.verifyIosReceipt(req.user.id, dto);
  }

  /**
   * Verify Android Google Play receipt
   */
  @Post("verify-android")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: "Verify Android Google Play receipt" })
  @ApiResponse({ status: 200, description: "Verification result" })
  async verifyAndroidReceipt(
    @Request() req: AuthenticatedRequest,
    @Body() dto: VerifyAndroidReceiptDto,
  ) {
    return this.mobileService.verifyAndroidReceipt(req.user.id, dto);
  }
}
