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
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ModerationService } from './moderation.service';
import { StoriesService } from '@/modules/stories/stories.service';
import {
  CreateReportDto,
  ResolveModerationDto,
  IssueWarningDto,
  IssueBanDto,
  ModerationQueueQuery,
  ModerationLogQuery,
  AssignReportDto,
  IssueMuteDto,
  CreateAppealDto,
  ReviewAppealDto,
  AppealsQueueQuery,
  BulkResolveDto,
  BulkAssignDto,
  BulkWarnDto,
} from './dto/moderation.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { UserRole } from '@aardvark/shared';

/**
 * Controller for content moderation, user reports, warnings, and bans.
 * Provides endpoints for both regular users (reporting) and admins (moderation actions).
 */
@ApiTags('moderation')
@Controller('moderation')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ModerationController {
  constructor(
    private readonly moderationService: ModerationService,
    @Inject(forwardRef(() => StoriesService))
    private readonly storiesService: StoriesService,
  ) {}

  // ============================================================================
  // Reports - User Actions
  // ============================================================================

  @Post('reports')
  @ApiOperation({ summary: 'Submit a content report (authenticated users)' })
  @ApiResponse({ status: 201, description: 'Report submitted successfully' })
  @ApiResponse({ status: 400, description: 'Already reported this content' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createReport(@Body() dto: CreateReportDto, @Request() req: any) {
    return this.moderationService.createReport(
      req.user.id,
      dto.contentType,
      dto.contentId,
      dto.reason,
      dto.details,
    );
  }

  // ============================================================================
  // Reports - Admin Actions
  // ============================================================================

  @Get('queue')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get moderation queue (admin/moderator only)' })
  @ApiResponse({ status: 200, description: 'Paginated list of reports' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires moderator role' })
  async getReportQueue(@Query() query: ModerationQueueQuery) {
    return this.moderationService.getReportQueue(query);
  }

  @Patch('reports/:id/assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign report to moderator (admin/moderator only)' })
  @ApiParam({ name: 'id', description: 'Report ID' })
  @ApiResponse({ status: 200, description: 'Report assigned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async assignReport(
    @Param('id') id: string,
    @Body() dto: AssignReportDto,
    @Request() req: any,
  ) {
    // If moderatorId is not provided, assign to self
    const moderatorId = dto.moderatorId || req.user.id;
    return this.moderationService.assignReport(id, moderatorId);
  }

  @Patch('reports/:id/resolve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Resolve a report with action (admin/moderator only)' })
  @ApiParam({ name: 'id', description: 'Report ID' })
  @ApiResponse({ status: 200, description: 'Report resolved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or report already resolved' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async resolveReport(
    @Param('id') id: string,
    @Body() dto: ResolveModerationDto,
    @Request() req: any,
  ) {
    return this.moderationService.resolveReport(
      id,
      req.user.id,
      dto.action,
      dto.notes,
    );
  }

  // ============================================================================
  // Warnings
  // ============================================================================

  @Post('warnings')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Issue warning to user (admin/moderator only)' })
  @ApiResponse({ status: 201, description: 'Warning issued successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async issueWarning(@Body() dto: IssueWarningDto, @Request() req: any) {
    return this.moderationService.issueWarning(
      dto.userId,
      req.user.id,
      dto.reason,
      dto.message,
      dto.reportId,
    );
  }

  @Get('warnings/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user warnings (admin/moderator only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'List of user warnings' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getUserWarnings(@Param('userId') userId: string) {
    return this.moderationService.getUserWarnings(userId);
  }

  // ============================================================================
  // Bans
  // ============================================================================

  @Post('bans')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Issue ban to user (admin/moderator only)' })
  @ApiResponse({ status: 201, description: 'Ban issued successfully' })
  @ApiResponse({ status: 400, description: 'User already has active ban' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async issueBan(@Body() dto: IssueBanDto, @Request() req: any) {
    let expiresAt: Date | undefined;

    if (!dto.isPermanent && dto.durationDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + dto.durationDays);
    }

    return this.moderationService.issueBan(
      dto.userId,
      req.user.id,
      dto.reason,
      dto.details,
      dto.isPermanent,
      expiresAt,
      dto.isShadowban,
    );
  }

  @Delete('bans/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lift ban (admin/moderator only)' })
  @ApiParam({ name: 'id', description: 'Ban ID' })
  @ApiResponse({ status: 200, description: 'Ban lifted successfully' })
  @ApiResponse({ status: 400, description: 'Ban already inactive' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ban not found' })
  async liftBan(@Param('id') id: string, @Request() req: any) {
    return this.moderationService.liftBan(id, req.user.id);
  }

  @Get('bans/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user bans (admin/moderator only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'List of user bans' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getUserBans(@Param('userId') userId: string) {
    return this.moderationService.getUserBans(userId);
  }

  @Get('bans/:userId/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Check if user is banned (admin/moderator only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Ban status' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async checkUserBanStatus(@Param('userId') userId: string) {
    return this.moderationService.isUserBanned(userId);
  }

  // ============================================================================
  // Moderation Logs & Stats
  // ============================================================================

  @Get('logs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get moderation audit logs (admin/moderator only)' })
  @ApiResponse({ status: 200, description: 'Paginated list of moderation logs' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getModerationLogs(@Query() query: ModerationLogQuery) {
    return this.moderationService.getModerationLogs(query);
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get moderation dashboard statistics (admin/moderator only)' })
  @ApiResponse({ status: 200, description: 'Moderation statistics' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getModerationStats() {
    return this.moderationService.getModerationStats();
  }

  // ============================================================================
  // Content Flags (Auto-flagged content)
  // ============================================================================

  @Get('flags')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get auto-flagged content (admin/moderator only)' })
  @ApiResponse({ status: 200, description: 'List of content flags' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getContentFlags(@Query() query: ModerationQueueQuery) {
    return this.moderationService.getContentFlags({
      page: query.page,
      limit: query.limit,
      contentType: query.contentType,
      status: query.status,
    });
  }

  @Patch('flags/:id/resolve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Resolve content flag (admin/moderator only)' })
  @ApiParam({ name: 'id', description: 'Flag ID' })
  @ApiResponse({ status: 200, description: 'Flag resolved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Flag not found' })
  async resolveContentFlag(
    @Param('id') id: string,
    @Body() dto: ResolveModerationDto,
    @Request() req: any,
  ) {
    return this.moderationService.resolveContentFlag(
      id,
      req.user.id,
      dto.action,
      dto.notes,
    );
  }

  // ============================================================================
  // Mutes (Feature restrictions)
  // ============================================================================

  @Post('mutes')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Issue mute to user (admin/moderator only)' })
  @ApiResponse({ status: 201, description: 'Mute issued successfully' })
  @ApiResponse({ status: 400, description: 'User already has active mute' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async issueMute(@Body() dto: IssueMuteDto, @Request() req: any) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + dto.durationDays);

    return this.moderationService.issueMute(
      dto.userId,
      req.user.id,
      dto.scope,
      dto.reason,
      dto.details,
      expiresAt,
    );
  }

  @Delete('mutes/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lift mute (admin/moderator only)' })
  @ApiParam({ name: 'id', description: 'Mute ID' })
  @ApiResponse({ status: 200, description: 'Mute lifted successfully' })
  async liftMute(@Param('id') id: string, @Request() req: any) {
    return this.moderationService.liftMute(id, req.user.id);
  }

  @Get('mutes/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user mutes (admin/moderator only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'List of user mutes' })
  async getUserMutes(@Param('userId') userId: string) {
    return this.moderationService.getUserMutes(userId);
  }

  // ============================================================================
  // Appeals
  // ============================================================================

  @Post('appeals')
  @ApiOperation({ summary: 'Submit ban appeal (banned users)' })
  @ApiResponse({ status: 201, description: 'Appeal submitted successfully' })
  @ApiResponse({ status: 400, description: 'Already have pending appeal' })
  @ApiResponse({ status: 404, description: 'Ban not found' })
  async createAppeal(@Body() dto: CreateAppealDto, @Request() req: any) {
    return this.moderationService.createAppeal(
      req.user.id,
      dto.banId,
      dto.reason,
      dto.additionalContext,
    );
  }

  @Get('appeals/me')
  @ApiOperation({ summary: 'Get my appeals' })
  @ApiResponse({ status: 200, description: 'List of user appeals' })
  async getMyAppeals(@Request() req: any) {
    return this.moderationService.getUserAppeals(req.user.id);
  }

  @Get('appeals/queue')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get appeals queue (admin/moderator only)' })
  @ApiResponse({ status: 200, description: 'List of pending appeals' })
  async getAppealsQueue(@Query() query: AppealsQueueQuery) {
    return this.moderationService.getAppealsQueue(query);
  }

  @Patch('appeals/:id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Review appeal (admin/moderator only)' })
  @ApiParam({ name: 'id', description: 'Appeal ID' })
  @ApiResponse({ status: 200, description: 'Appeal reviewed successfully' })
  async reviewAppeal(
    @Param('id') id: string,
    @Body() dto: ReviewAppealDto,
    @Request() req: any,
  ) {
    return this.moderationService.reviewAppeal(
      id,
      req.user.id,
      dto.approved,
      dto.notes,
    );
  }

  // ============================================================================
  // Bulk Actions
  // ============================================================================

  @Post('bulk/resolve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Bulk resolve reports (admin/moderator only)' })
  @ApiResponse({ status: 200, description: 'Reports resolved' })
  async bulkResolveReports(@Body() dto: BulkResolveDto, @Request() req: any) {
    return this.moderationService.bulkResolveReports(
      dto.reportIds,
      req.user.id,
      dto.action,
      dto.notes,
    );
  }

  @Post('bulk/assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Bulk assign reports (admin/moderator only)' })
  @ApiResponse({ status: 200, description: 'Reports assigned' })
  async bulkAssignReports(@Body() dto: BulkAssignDto, @Request() req: any) {
    const moderatorId = dto.moderatorId || req.user.id;
    return this.moderationService.bulkAssignReports(dto.reportIds, moderatorId);
  }

  @Post('bulk/warn')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Bulk issue warnings (admin/moderator only)' })
  @ApiResponse({ status: 200, description: 'Warnings issued' })
  async bulkIssueWarnings(@Body() dto: BulkWarnDto, @Request() req: any) {
    return this.moderationService.bulkIssueWarnings(
      dto.userIds,
      req.user.id,
      dto.reason,
      dto.message,
    );
  }

  // ============================================================================
  // Priority Queue
  // ============================================================================

  @Get('queue/prioritized')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get prioritized moderation queue (admin/moderator only)' })
  @ApiResponse({ status: 200, description: 'Prioritized list of reports' })
  async getPrioritizedQueue(@Query() query: ModerationQueueQuery) {
    return this.moderationService.getPrioritizedReportQueue(query);
  }

  @Get('users/:userId/strikes')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user strike count (admin/moderator only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Strike count' })
  async getUserStrikes(@Param('userId') userId: string) {
    const count = await this.moderationService.getUserStrikeCount(userId);
    return { userId, strikeCount: count };
  }

  // ============================================================================
  // Story Moderation (Pre-publication Review)
  // ============================================================================

  @Get('stories/queue')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get stories pending moderation review' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Stories pending review' })
  async getStoryModerationQueue(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.storiesService.findPendingReview(page || 1, limit || 20);
  }

  @Get('stories/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get story details for moderation' })
  @ApiParam({ name: 'id', description: 'Story ID' })
  @ApiResponse({ status: 200, description: 'Story details retrieved' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async getStoryForModeration(@Param('id') id: string) {
    return this.storiesService.findOne(id);
  }

  @Post('stories/:id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve a story for publication' })
  @ApiParam({ name: 'id', description: 'Story ID' })
  @ApiResponse({ status: 200, description: 'Story approved and published' })
  @ApiResponse({ status: 403, description: 'Story not pending review' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async approveStory(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { notes?: string },
  ) {
    return this.storiesService.approveStory(id, req.user.id, body.notes);
  }

  @Post('stories/:id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Reject a story' })
  @ApiParam({ name: 'id', description: 'Story ID' })
  @ApiResponse({ status: 200, description: 'Story rejected' })
  @ApiResponse({ status: 403, description: 'Story not pending review' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async rejectStory(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { reason: string },
  ) {
    return this.storiesService.rejectStory(id, req.user.id, body.reason);
  }

  @Post('stories/:id/request-changes')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Request changes on a story' })
  @ApiParam({ name: 'id', description: 'Story ID' })
  @ApiResponse({ status: 200, description: 'Changes requested' })
  @ApiResponse({ status: 403, description: 'Story not pending review' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async requestStoryChanges(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { notes: string },
  ) {
    return this.storiesService.requestChanges(id, req.user.id, body.notes);
  }
}
