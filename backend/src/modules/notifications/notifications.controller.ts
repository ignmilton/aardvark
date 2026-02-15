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
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { PushNotificationService } from "./push-notification.service";
import {
  NotificationQueryDto,
  MarkReadDto,
  PushSubscribeDto,
  PushUnsubscribeDto,
} from "./dto";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";

@ApiTags("notifications")
@Controller("notifications")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get user notifications with pagination" })
  @ApiResponse({ status: 200, description: "List of notifications" })
  async getUserNotifications(
    @Query() query: NotificationQueryDto,
    @Request() req: any,
  ) {
    return this.notificationsService.getUserNotifications(req.user.id, query);
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Get unread notification count" })
  @ApiResponse({ status: 200, description: "Unread notification count" })
  async getUnreadCount(@Request() req: any) {
    const count = await this.notificationsService.getUnreadCount(req.user.id);
    return { count };
  }

  @Patch("read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark specific notifications as read" })
  @ApiResponse({ status: 200, description: "Notifications marked as read" })
  @ApiResponse({
    status: 403,
    description: "Not authorized to mark these notifications",
  })
  async markAsRead(@Body() markReadDto: MarkReadDto, @Request() req: any) {
    await this.notificationsService.markAsRead(
      req.user.id,
      markReadDto.notificationIds,
    );
    return { success: true };
  }

  @Patch("read-all")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark all notifications as read" })
  @ApiResponse({ status: 200, description: "All notifications marked as read" })
  async markAllAsRead(@Request() req: any) {
    await this.notificationsService.markAllAsRead(req.user.id);
    return { success: true };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a notification" })
  @ApiParam({ name: "id", description: "Notification ID" })
  @ApiResponse({ status: 204, description: "Notification deleted" })
  @ApiResponse({ status: 404, description: "Notification not found" })
  async deleteNotification(@Param("id") id: string, @Request() req: any) {
    await this.notificationsService.deleteNotification(req.user.id, id);
  }

  @Post("push/subscribe")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Subscribe to push notifications" })
  @ApiResponse({ status: 200, description: "Push subscription registered" })
  async pushSubscribe(@Body() dto: PushSubscribeDto, @Request() req: any) {
    await this.pushNotificationService.subscribe(
      req.user.id,
      dto.endpoint,
      dto.keys.p256dh,
      dto.keys.auth,
      req.headers["user-agent"],
    );
    return { success: true };
  }

  @Post("push/unsubscribe")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Unsubscribe from push notifications" })
  @ApiResponse({ status: 200, description: "Push subscription removed" })
  async pushUnsubscribe(@Body() dto: PushUnsubscribeDto, @Request() req: any) {
    await this.pushNotificationService.unsubscribe(req.user.id, dto.endpoint);
    return { success: true };
  }
}
