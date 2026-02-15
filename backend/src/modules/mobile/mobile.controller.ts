import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
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
  async getSync(@Request() req: any, @Query() query: SyncRequestDto) {
    return this.mobileService.syncProgress(req.user.id, query);
  }

  /**
   * Upload offline reading progress to server
   * Used to sync progress made while offline
   */
  @Post("sync")
  @ApiOperation({ summary: "Upload offline reading progress" })
  @ApiResponse({ status: 200, description: "Progress synced" })
  async uploadSync(@Request() req: any, @Body() dto: SyncProgressDto) {
    return this.mobileService.uploadProgress(req.user.id, dto.progress);
  }

  // ============================================================================
  // Push Notifications
  // ============================================================================

  /**
   * Register a push notification token
   */
  @Post("push-token")
  @ApiOperation({ summary: "Register push notification token" })
  @ApiResponse({ status: 200, description: "Token registered" })
  async registerPushToken(
    @Request() req: any,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.mobileService.registerPushToken(req.user.id, dto);
  }

  /**
   * Unregister a push notification token
   */
  @Delete("push-token")
  @ApiOperation({ summary: "Unregister push notification token" })
  @ApiResponse({ status: 200, description: "Token unregistered" })
  async unregisterPushToken(
    @Request() req: any,
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
  async getPushSettings(@Request() req: any) {
    return this.mobileService.getPushSettings(req.user.id);
  }

  // ============================================================================
  // Mobile Subscription Verification
  // ============================================================================

  /**
   * Verify iOS App Store receipt
   */
  @Post("verify-ios")
  @ApiOperation({ summary: "Verify iOS App Store receipt" })
  @ApiResponse({ status: 200, description: "Verification result" })
  async verifyIosReceipt(
    @Request() req: any,
    @Body() dto: VerifyIosReceiptDto,
  ) {
    return this.mobileService.verifyIosReceipt(req.user.id, dto);
  }

  /**
   * Verify Android Google Play receipt
   */
  @Post("verify-android")
  @ApiOperation({ summary: "Verify Android Google Play receipt" })
  @ApiResponse({ status: 200, description: "Verification result" })
  async verifyAndroidReceipt(
    @Request() req: any,
    @Body() dto: VerifyAndroidReceiptDto,
  ) {
    return this.mobileService.verifyAndroidReceipt(req.user.id, dto);
  }
}
