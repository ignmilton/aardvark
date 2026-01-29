import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, In, IsNull, Not, LessThan, MoreThan } from 'typeorm';
import {
  Report,
  ModerationLog,
  UserWarning,
  UserBan,
  ContentFlag,
  ModerationContentType,
  ReportReason,
  ModerationStatus,
  ModerationAction,
  User,
  BanAppeal,
  UserMute,
} from '@/database/entities';
import { AppealStatus } from '@/database/entities/ban-appeal.entity';
import { MuteScope } from '@/database/entities/user-mute.entity';
import { AccountStatus } from '@aardvark/shared';
import { ModerationQueueQuery, ModerationLogQuery } from './dto/moderation.dto';

/**
 * Service handling content moderation, user reports, warnings, and bans.
 * Provides admin tools for managing platform content and user behavior.
 */
@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    @InjectRepository(ModerationLog)
    private moderationLogRepository: Repository<ModerationLog>,
    @InjectRepository(UserWarning)
    private userWarningRepository: Repository<UserWarning>,
    @InjectRepository(UserBan)
    private userBanRepository: Repository<UserBan>,
    @InjectRepository(ContentFlag)
    private contentFlagRepository: Repository<ContentFlag>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(BanAppeal)
    private banAppealRepository: Repository<BanAppeal>,
    @InjectRepository(UserMute)
    private userMuteRepository: Repository<UserMute>,
  ) {}

  /**
   * Create a new report for content
   */
  async createReport(
    reporterId: string,
    contentType: ModerationContentType,
    contentId: string,
    reason: ReportReason,
    details?: string,
  ): Promise<Report> {
    // Check if user already reported this content
    const existingReport = await this.reportRepository.findOne({
      where: {
        reporterId,
        contentType,
        contentId,
        status: In([ModerationStatus.PENDING, ModerationStatus.UNDER_REVIEW]),
      },
    });

    if (existingReport) {
      throw new BadRequestException('You have already reported this content');
    }

    const report = this.reportRepository.create({
      reporterId,
      contentType,
      contentId,
      reason,
      details: details || null,
      status: ModerationStatus.PENDING,
      actionTaken: ModerationAction.NONE,
    });

    return this.reportRepository.save(report);
  }

  /**
   * Get moderation queue with pagination and filters
   */
  async getReportQueue(query: ModerationQueueQuery): Promise<{
    reports: Report[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit: rawLimit = 20,
      contentType,
      status,
      assignedTo,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;
    const limit = Math.min(Math.max(1, rawLimit), 50);

    const where: FindOptionsWhere<Report> = {};

    if (contentType) {
      where.contentType = contentType;
    }

    if (status) {
      where.status = status;
    }

    if (assignedTo === 'unassigned') {
      where.assignedModeratorId = IsNull();
    } else if (assignedTo) {
      where.assignedModeratorId = assignedTo;
    }

    const [reports, total] = await this.reportRepository.findAndCount({
      where,
      relations: ['reporter', 'contentAuthor', 'assignedModerator'],
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      reports,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Assign a report to a moderator
   */
  async assignReport(reportId: string, moderatorId: string): Promise<Report> {
    const report = await this.reportRepository.findOne({
      where: { id: reportId },
      relations: ['assignedModerator'],
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.status === ModerationStatus.RESOLVED) {
      throw new BadRequestException('Cannot assign a resolved report');
    }

    // Verify moderator exists and has appropriate role
    const moderator = await this.userRepository.findOne({
      where: { id: moderatorId },
    });

    if (!moderator || !moderator.canModerate) {
      throw new BadRequestException('Invalid moderator');
    }

    report.assignedModeratorId = moderatorId;
    report.status = ModerationStatus.UNDER_REVIEW;

    return this.reportRepository.save(report);
  }

  /**
   * Resolve a report with moderation action
   */
  async resolveReport(
    reportId: string,
    moderatorId: string,
    action: ModerationAction,
    notes?: string,
  ): Promise<Report> {
    const report = await this.reportRepository.findOne({
      where: { id: reportId },
      relations: ['reporter', 'contentAuthor'],
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.status === ModerationStatus.RESOLVED) {
      throw new BadRequestException('Report already resolved');
    }

    // Update report
    report.actionTaken = action;
    report.moderatorNotes = notes || null;
    report.status = ModerationStatus.RESOLVED;
    report.resolvedAt = new Date();
    report.assignedModeratorId = moderatorId;

    const savedReport = await this.reportRepository.save(report);

    // Create moderation log
    await this.createModerationLog(
      moderatorId,
      action,
      report.contentType,
      report.contentId,
      report.contentAuthorId,
      reportId,
      notes || `Resolved report with action: ${action}`,
    );

    return savedReport;
  }

  /**
   * Issue a warning to a user
   */
  async issueWarning(
    userId: string,
    issuerId: string,
    reason: ReportReason,
    message: string,
    reportId?: string,
  ): Promise<UserWarning> {
    // Verify user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const warning = this.userWarningRepository.create({
      userId,
      issuedById: issuerId,
      reason,
      message,
      reportId: reportId || null,
      acknowledged: false,
    });

    const savedWarning = await this.userWarningRepository.save(warning);

    // Create moderation log
    await this.createModerationLog(
      issuerId,
      ModerationAction.USER_WARNED,
      ModerationContentType.USER_PROFILE,
      userId,
      userId,
      reportId || null,
      `Warning issued: ${message}`,
    );

    return savedWarning;
  }

  /**
   * Get warnings for a user
   */
  async getUserWarnings(userId: string): Promise<UserWarning[]> {
    return this.userWarningRepository.find({
      where: { userId },
      relations: ['issuedBy', 'report'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Issue a ban to a user
   */
  async issueBan(
    userId: string,
    issuerId: string,
    reason: ReportReason,
    details: string,
    isPermanent: boolean,
    expiresAt?: Date,
    isShadowban: boolean = false,
  ): Promise<UserBan> {
    // Verify user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user already has an active ban
    const existingBan = await this.userBanRepository.findOne({
      where: {
        userId,
        isActive: true,
      },
    });

    if (existingBan) {
      throw new BadRequestException('User already has an active ban');
    }

    // Validate expiration for non-permanent bans
    if (!isPermanent && !expiresAt) {
      throw new BadRequestException('Temporary bans must have an expiration date');
    }

    const ban = this.userBanRepository.create({
      userId,
      issuedById: issuerId,
      reason,
      details,
      isPermanent,
      expiresAt: isPermanent ? null : expiresAt,
      isShadowban,
      isActive: true,
    });

    const savedBan = await this.userBanRepository.save(ban);

    // Update user account status
    await this.userRepository.update(userId, {
      accountStatus: isPermanent ? AccountStatus.BANNED : AccountStatus.SUSPENDED,
    });

    // Determine action type
    let action: ModerationAction;
    if (isShadowban) {
      action = ModerationAction.USER_SHADOWBAN;
    } else if (isPermanent) {
      action = ModerationAction.USER_PERM_BAN;
    } else {
      action = ModerationAction.USER_TEMP_BAN;
    }

    // Create moderation log
    await this.createModerationLog(
      issuerId,
      action,
      ModerationContentType.USER_PROFILE,
      userId,
      userId,
      null,
      `Ban issued: ${details}`,
    );

    return savedBan;
  }

  /**
   * Lift a ban
   */
  async liftBan(banId: string, liftedById: string): Promise<UserBan> {
    const ban = await this.userBanRepository.findOne({
      where: { id: banId },
      relations: ['user'],
    });

    if (!ban) {
      throw new NotFoundException('Ban not found');
    }

    if (!ban.isActive) {
      throw new BadRequestException('Ban is already inactive');
    }

    ban.isActive = false;
    ban.liftedAt = new Date();
    ban.liftedById = liftedById;

    const savedBan = await this.userBanRepository.save(ban);

    // Restore user account status
    await this.userRepository.update(ban.userId, {
      accountStatus: AccountStatus.ACTIVE,
    });

    // Create moderation log
    await this.createModerationLog(
      liftedById,
      ModerationAction.NONE,
      ModerationContentType.USER_PROFILE,
      ban.userId,
      ban.userId,
      null,
      'Ban lifted',
    );

    return savedBan;
  }

  /**
   * Get all bans for a user
   */
  async getUserBans(userId: string): Promise<UserBan[]> {
    return this.userBanRepository.find({
      where: { userId },
      relations: ['issuedBy', 'liftedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Check if a user is currently banned
   */
  async isUserBanned(userId: string): Promise<{
    isBanned: boolean;
    ban: UserBan | null;
  }> {
    const activeBan = await this.userBanRepository.findOne({
      where: {
        userId,
        isActive: true,
      },
      relations: ['issuedBy'],
    });

    // Check if temporary ban has expired
    if (activeBan && !activeBan.isPermanent && activeBan.expiresAt) {
      if (new Date() > activeBan.expiresAt) {
        // Auto-expire the ban
        activeBan.isActive = false;
        await this.userBanRepository.save(activeBan);
        return { isBanned: false, ban: null };
      }
    }

    return {
      isBanned: !!activeBan,
      ban: activeBan || null,
    };
  }

  /**
   * Get moderation logs with filters
   */
  async getModerationLogs(query: ModerationLogQuery): Promise<{
    logs: ModerationLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit: rawLimit = 20,
      moderatorId,
      contentType,
      action,
      targetUserId,
    } = query;
    const limit = Math.min(Math.max(1, rawLimit), 50);

    const where: FindOptionsWhere<ModerationLog> = {};

    if (moderatorId) {
      where.moderatorId = moderatorId;
    }

    if (contentType) {
      where.contentType = contentType;
    }

    if (action) {
      where.action = action;
    }

    if (targetUserId) {
      where.targetUserId = targetUserId;
    }

    const [logs, total] = await this.moderationLogRepository.findAndCount({
      where,
      relations: ['moderator', 'targetUser', 'report'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a moderation log entry
   */
  private async createModerationLog(
    moderatorId: string,
    action: ModerationAction,
    contentType: ModerationContentType,
    contentId: string,
    targetUserId: string | null,
    reportId: string | null,
    reason: string,
    metadata?: Record<string, unknown>,
  ): Promise<ModerationLog> {
    const log = this.moderationLogRepository.create({
      moderatorId,
      action,
      contentType,
      contentId,
      targetUserId,
      reportId,
      reason,
      metadata: metadata || null,
    });

    return this.moderationLogRepository.save(log);
  }

  /**
   * Create a content flag (auto-flagged by system)
   */
  async createContentFlag(
    contentType: ModerationContentType,
    contentId: string,
    authorId: string | null,
    flagType: string,
    confidence: number,
    patterns?: string,
  ): Promise<ContentFlag> {
    const flag = this.contentFlagRepository.create({
      contentType,
      contentId,
      authorId,
      flagType,
      confidence,
      matchedPatterns: patterns || null,
      status: ModerationStatus.PENDING,
      isAutoResolved: false,
    });

    return this.contentFlagRepository.save(flag);
  }

  /**
   * Get moderation dashboard statistics
   */
  async getModerationStats(): Promise<{
    pendingReports: number;
    underReviewReports: number;
    resolvedToday: number;
    totalActiveBans: number;
    totalActiveWarnings: number;
    pendingFlags: number;
    reportsByReason: Record<string, number>;
    actionsTakenToday: Record<string, number>;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get report counts
    const pendingReports = await this.reportRepository.count({
      where: { status: ModerationStatus.PENDING },
    });

    const underReviewReports = await this.reportRepository.count({
      where: { status: ModerationStatus.UNDER_REVIEW },
    });

    const resolvedToday = await this.reportRepository.count({
      where: {
        status: ModerationStatus.RESOLVED,
        resolvedAt: MoreThan(today),
      },
    });

    // Get ban and warning counts
    const totalActiveBans = await this.userBanRepository.count({
      where: { isActive: true },
    });

    // Count active warnings: not acknowledged AND (no expiry OR expiry in future)
    // Fixed: The original query used Not(LessThan(new Date())) which had incorrect logic
    // for null expiresAt values. Now we properly handle both cases.
    const totalActiveWarnings = await this.userWarningRepository
      .createQueryBuilder('warning')
      .where('warning.acknowledged = :acknowledged', { acknowledged: false })
      .andWhere('(warning.expiresAt IS NULL OR warning.expiresAt > :now)', { now: new Date() })
      .getCount();

    // Get pending flags
    const pendingFlags = await this.contentFlagRepository.count({
      where: { status: ModerationStatus.PENDING },
    });

    // Reports by reason
    const reportsByReasonData = await this.reportRepository
      .createQueryBuilder('report')
      .select('report.reason', 'reason')
      .addSelect('COUNT(*)', 'count')
      .where('report.status = :status', { status: ModerationStatus.PENDING })
      .groupBy('report.reason')
      .getRawMany();

    const reportsByReason: Record<string, number> = {};
    reportsByReasonData.forEach((item) => {
      reportsByReason[item.reason] = parseInt(item.count);
    });

    // Actions taken today
    const actionsTakenData = await this.moderationLogRepository
      .createQueryBuilder('log')
      .select('log.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where('log.createdAt >= :today', { today })
      .groupBy('log.action')
      .getRawMany();

    const actionsTakenToday: Record<string, number> = {};
    actionsTakenData.forEach((item) => {
      actionsTakenToday[item.action] = parseInt(item.count);
    });

    return {
      pendingReports,
      underReviewReports,
      resolvedToday,
      totalActiveBans,
      totalActiveWarnings,
      pendingFlags,
      reportsByReason,
      actionsTakenToday,
    };
  }

  /**
   * Get content flags with pagination
   */
  async getContentFlags(query: {
    page?: number;
    limit?: number;
    contentType?: ModerationContentType;
    status?: ModerationStatus;
    flagType?: string;
  }): Promise<{
    flags: ContentFlag[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit: rawLimit = 20, contentType, status, flagType } = query;
    const limit = Math.min(Math.max(1, rawLimit), 50);

    const where: FindOptionsWhere<ContentFlag> = {};

    if (contentType) {
      where.contentType = contentType;
    }

    if (status) {
      where.status = status;
    }

    if (flagType) {
      where.flagType = flagType;
    }

    const [flags, total] = await this.contentFlagRepository.findAndCount({
      where,
      relations: ['author'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      flags,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Resolve a content flag
   */
  async resolveContentFlag(
    flagId: string,
    moderatorId: string,
    action: ModerationAction,
    notes?: string,
  ): Promise<ContentFlag> {
    const flag = await this.contentFlagRepository.findOne({
      where: { id: flagId },
    });

    if (!flag) {
      throw new NotFoundException('Content flag not found');
    }

    flag.status = ModerationStatus.RESOLVED;

    const savedFlag = await this.contentFlagRepository.save(flag);

    // Create moderation log
    await this.createModerationLog(
      moderatorId,
      action,
      flag.contentType,
      flag.contentId,
      flag.authorId,
      null,
      notes || `Resolved auto-flag (${flag.flagType}) with action: ${action}`,
      { flagType: flag.flagType, confidence: flag.confidence },
    );

    return savedFlag;
  }

  // ============================================
  // MUTE FUNCTIONALITY
  // ============================================

  /**
   * Issue a mute to a user (restrict specific features)
   */
  async issueMute(
    userId: string,
    issuerId: string,
    scope: MuteScope,
    reason: ReportReason,
    details: string,
    expiresAt: Date,
  ): Promise<UserMute> {
    // Verify user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check for existing active mute with same scope
    const existingMute = await this.userMuteRepository.findOne({
      where: {
        userId,
        scope,
        isActive: true,
      },
    });

    if (existingMute) {
      throw new BadRequestException(`User already has an active ${scope} mute`);
    }

    const mute = this.userMuteRepository.create({
      userId,
      issuedById: issuerId,
      scope,
      reason,
      details,
      expiresAt,
      isActive: true,
    });

    const savedMute = await this.userMuteRepository.save(mute);

    // Create moderation log
    await this.createModerationLog(
      issuerId,
      ModerationAction.USER_WARNED,
      ModerationContentType.USER_PROFILE,
      userId,
      userId,
      null,
      `Mute issued (${scope}): ${details}`,
      { muteScope: scope, expiresAt },
    );

    return savedMute;
  }

  /**
   * Lift a mute
   */
  async liftMute(muteId: string, liftedById: string): Promise<UserMute> {
    const mute = await this.userMuteRepository.findOne({
      where: { id: muteId },
    });

    if (!mute) {
      throw new NotFoundException('Mute not found');
    }

    if (!mute.isActive) {
      throw new BadRequestException('Mute is already inactive');
    }

    mute.isActive = false;
    mute.liftedAt = new Date();
    mute.liftedById = liftedById;

    const savedMute = await this.userMuteRepository.save(mute);

    await this.createModerationLog(
      liftedById,
      ModerationAction.NONE,
      ModerationContentType.USER_PROFILE,
      mute.userId,
      mute.userId,
      null,
      `Mute lifted (${mute.scope})`,
    );

    return savedMute;
  }

  /**
   * Get user's active mutes
   */
  async getUserMutes(userId: string): Promise<UserMute[]> {
    return this.userMuteRepository.find({
      where: { userId, isActive: true },
      relations: ['issuedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Check if user is muted for a specific scope
   */
  async isUserMuted(userId: string, scope: MuteScope): Promise<{
    isMuted: boolean;
    mute: UserMute | null;
  }> {
    // Check for specific scope or ALL scope
    const activeMute = await this.userMuteRepository.findOne({
      where: [
        { userId, scope, isActive: true },
        { userId, scope: MuteScope.ALL, isActive: true },
      ],
    });

    // Auto-expire if past expiration
    if (activeMute && new Date() > activeMute.expiresAt) {
      activeMute.isActive = false;
      await this.userMuteRepository.save(activeMute);
      return { isMuted: false, mute: null };
    }

    return {
      isMuted: !!activeMute,
      mute: activeMute || null,
    };
  }

  // ============================================
  // APPEAL SYSTEM
  // ============================================

  /**
   * Create a ban appeal
   */
  async createAppeal(
    userId: string,
    banId: string,
    reason: string,
    additionalContext?: string,
  ): Promise<BanAppeal> {
    // Verify ban exists and belongs to user
    const ban = await this.userBanRepository.findOne({
      where: { id: banId, userId },
    });

    if (!ban) {
      throw new NotFoundException('Ban not found');
    }

    // Check for existing pending appeal
    const existingAppeal = await this.banAppealRepository.findOne({
      where: {
        userId,
        banId,
        status: In([AppealStatus.PENDING, AppealStatus.UNDER_REVIEW]),
      },
    });

    if (existingAppeal) {
      throw new BadRequestException('You already have a pending appeal for this ban');
    }

    const appeal = this.banAppealRepository.create({
      userId,
      banId,
      reason,
      additionalContext: additionalContext || null,
      status: AppealStatus.PENDING,
    });

    return this.banAppealRepository.save(appeal);
  }

  /**
   * Get appeals queue
   */
  async getAppealsQueue(query: {
    page?: number;
    limit?: number;
    status?: AppealStatus;
  }): Promise<{
    appeals: BanAppeal[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit: rawLimit = 20, status } = query;
    const limit = Math.min(Math.max(1, rawLimit), 50);

    const where: FindOptionsWhere<BanAppeal> = {};
    if (status) {
      where.status = status;
    }

    const [appeals, total] = await this.banAppealRepository.findAndCount({
      where,
      relations: ['user', 'ban', 'ban.issuedBy', 'reviewedBy'],
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      appeals,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Review an appeal
   */
  async reviewAppeal(
    appealId: string,
    reviewerId: string,
    approved: boolean,
    notes?: string,
  ): Promise<BanAppeal> {
    const appeal = await this.banAppealRepository.findOne({
      where: { id: appealId },
      relations: ['ban'],
    });

    if (!appeal) {
      throw new NotFoundException('Appeal not found');
    }

    if (appeal.status !== AppealStatus.PENDING && appeal.status !== AppealStatus.UNDER_REVIEW) {
      throw new BadRequestException('Appeal has already been reviewed');
    }

    appeal.status = approved ? AppealStatus.APPROVED : AppealStatus.REJECTED;
    appeal.reviewedById = reviewerId;
    appeal.reviewNotes = notes || null;
    appeal.reviewedAt = new Date();

    const savedAppeal = await this.banAppealRepository.save(appeal);

    // If approved, lift the ban
    if (approved && appeal.ban) {
      await this.liftBan(appeal.banId, reviewerId);
    }

    await this.createModerationLog(
      reviewerId,
      approved ? ModerationAction.NONE : ModerationAction.USER_WARNED,
      ModerationContentType.USER_PROFILE,
      appeal.userId,
      appeal.userId,
      null,
      `Appeal ${approved ? 'approved' : 'rejected'}: ${notes || 'No notes'}`,
      { appealId, approved },
    );

    return savedAppeal;
  }

  /**
   * Get user's appeals
   */
  async getUserAppeals(userId: string): Promise<BanAppeal[]> {
    return this.banAppealRepository.find({
      where: { userId },
      relations: ['ban', 'reviewedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  // ============================================
  // BULK ACTIONS
  // ============================================

  /**
   * Bulk resolve reports
   */
  async bulkResolveReports(
    reportIds: string[],
    moderatorId: string,
    action: ModerationAction,
    notes?: string,
  ): Promise<{ resolved: number; failed: string[] }> {
    const resolved: string[] = [];
    const failed: string[] = [];

    for (const reportId of reportIds) {
      try {
        await this.resolveReport(reportId, moderatorId, action, notes);
        resolved.push(reportId);
      } catch (error) {
        failed.push(reportId);
      }
    }

    return { resolved: resolved.length, failed };
  }

  /**
   * Bulk assign reports to moderator
   */
  async bulkAssignReports(
    reportIds: string[],
    moderatorId: string,
  ): Promise<{ assigned: number; failed: string[] }> {
    const assigned: string[] = [];
    const failed: string[] = [];

    for (const reportId of reportIds) {
      try {
        await this.assignReport(reportId, moderatorId);
        assigned.push(reportId);
      } catch (error) {
        failed.push(reportId);
      }
    }

    return { assigned: assigned.length, failed };
  }

  /**
   * Bulk issue warnings
   */
  async bulkIssueWarnings(
    userIds: string[],
    issuerId: string,
    reason: ReportReason,
    message: string,
  ): Promise<{ issued: number; failed: string[] }> {
    const issued: string[] = [];
    const failed: string[] = [];

    for (const userId of userIds) {
      try {
        await this.issueWarning(userId, issuerId, reason, message);
        issued.push(userId);
      } catch (error) {
        failed.push(userId);
      }
    }

    return { issued: issued.length, failed };
  }

  // ============================================
  // PRIORITY SCORING
  // ============================================

  /**
   * Calculate priority score for a report
   */
  calculateReportPriority(report: Report): number {
    let score = 0;

    // Base score by reason severity
    const reasonScores: Record<ReportReason, number> = {
      [ReportReason.SPAM]: 20,
      [ReportReason.HARASSMENT]: 40,
      [ReportReason.HATE_SPEECH]: 50,
      [ReportReason.INAPPROPRIATE_CONTENT]: 35,
      [ReportReason.SEXUAL_CONTENT]: 40,
      [ReportReason.SELF_HARM]: 60,
      [ReportReason.COPYRIGHT]: 30,
      [ReportReason.VIOLENCE]: 50,
      [ReportReason.MISINFORMATION]: 25,
      [ReportReason.IMPERSONATION]: 35,
      [ReportReason.OTHER]: 15,
    };

    score += reasonScores[report.reason] || 15;

    // Recency bonus (newer reports get higher priority)
    const ageInHours = (Date.now() - new Date(report.createdAt).getTime()) / (1000 * 60 * 60);
    if (ageInHours < 1) score += 20;
    else if (ageInHours < 6) score += 15;
    else if (ageInHours < 24) score += 10;
    else if (ageInHours < 72) score += 5;

    // Content type priority
    const contentTypeScores: Record<ModerationContentType, number> = {
      [ModerationContentType.STORY]: 10,
      [ModerationContentType.SEGMENT]: 10,
      [ModerationContentType.COMMENT]: 15,
      [ModerationContentType.RATING]: 10,
      [ModerationContentType.FORUM_POST]: 15,
      [ModerationContentType.FORUM_THREAD]: 15,
      [ModerationContentType.MESSAGE]: 20,
      [ModerationContentType.USER_PROFILE]: 25,
    };

    score += contentTypeScores[report.contentType] || 10;

    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Get prioritized report queue
   */
  async getPrioritizedReportQueue(query: ModerationQueueQuery): Promise<{
    reports: (Report & { priorityScore: number })[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const result = await this.getReportQueue({
      ...query,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });

    // Calculate priority scores and sort
    const reportsWithPriority = result.reports.map(report => ({
      ...report,
      priorityScore: this.calculateReportPriority(report),
    }));

    // Sort by priority score descending
    reportsWithPriority.sort((a, b) => b.priorityScore - a.priorityScore);

    return {
      reports: reportsWithPriority,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  /**
   * Get strike count for a user (warnings in last 90 days)
   */
  async getUserStrikeCount(userId: string): Promise<number> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    return this.userWarningRepository.count({
      where: {
        userId,
        createdAt: MoreThan(ninetyDaysAgo),
      },
    });
  }

  /**
   * Check if user should be auto-banned (3 strikes)
   */
  async checkAutoban(userId: string, issuerId: string): Promise<boolean> {
    const strikeCount = await this.getUserStrikeCount(userId);

    if (strikeCount >= 3) {
      // Check if not already banned
      const { isBanned } = await this.isUserBanned(userId);
      if (!isBanned) {
        await this.issueBan(
          userId,
          issuerId,
          ReportReason.OTHER,
          'Automatic ban: 3 strikes policy',
          false,
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          false,
        );
        return true;
      }
    }

    return false;
  }
}
