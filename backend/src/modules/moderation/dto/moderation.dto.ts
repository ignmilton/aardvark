import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
  Min,
  Max,
  ArrayMaxSize,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ModerationContentType,
  ReportReason,
  ModerationAction,
  ModerationStatus,
} from "@/database/entities/moderation.entity";
import { MuteScope } from "@/database/entities/user-mute.entity";
import { AppealStatus } from "@/database/entities/ban-appeal.entity";

/**
 * DTO for creating a new report
 */
export class CreateReportDto {
  @ApiProperty({
    enum: ModerationContentType,
    description: "Type of content being reported",
  })
  @IsEnum(ModerationContentType)
  contentType: ModerationContentType;

  @ApiProperty({ description: "ID of the content being reported" })
  @IsUUID()
  contentId: string;

  @ApiProperty({ enum: ReportReason, description: "Reason for the report" })
  @IsEnum(ReportReason)
  reason: ReportReason;

  @ApiProperty({ description: "Detailed description of the issue" })
  @IsString()
  details: string;

  @ApiPropertyOptional({ type: [String], description: "URLs or text evidence" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  evidence?: string[];
}

/**
 * DTO for resolving a moderation report
 */
export class ResolveModerationDto {
  @ApiProperty({
    enum: ModerationAction,
    description: "Action to take on the report",
  })
  @IsEnum(ModerationAction)
  action: ModerationAction;

  @ApiProperty({ description: "Reason for the action" })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: "Additional details or notes" })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: "Edited content if action is EDIT" })
  @IsOptional()
  @IsString()
  editedContent?: string;

  @ApiPropertyOptional({ description: "Ban duration in days for TEMP_BAN" })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  banDuration?: number;
}

/**
 * DTO for issuing a warning to a user
 */
export class IssueWarningDto {
  @ApiProperty({ description: "ID of the user to warn" })
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: ReportReason, description: "Reason for the warning" })
  @IsEnum(ReportReason)
  reason: ReportReason;

  @ApiProperty({ description: "Warning message" })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: "Related report ID" })
  @IsOptional()
  @IsUUID()
  reportId?: string;

  @ApiPropertyOptional({ description: "Days until warning expires" })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}

/**
 * DTO for issuing a ban to a user
 */
export class IssueBanDto {
  @ApiProperty({ description: "ID of the user to ban" })
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: ReportReason, description: "Reason for the ban" })
  @IsEnum(ReportReason)
  reason: ReportReason;

  @ApiProperty({ description: "Detailed explanation of the ban" })
  @IsString()
  details: string;

  @ApiProperty({ description: "Is this a permanent ban" })
  @IsBoolean()
  isPermanent: boolean;

  @ApiPropertyOptional({
    description: "Days until ban expires (required if not permanent)",
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3650)
  durationDays?: number;

  @ApiProperty({ description: "Is this a shadowban" })
  @IsBoolean()
  isShadowban: boolean;

  @ApiPropertyOptional({ description: "Related report ID" })
  @IsOptional()
  @IsUUID()
  reportId?: string;
}

/**
 * DTO for lifting a ban
 */
export class LiftBanDto {
  @ApiProperty({ description: "Reason for lifting the ban" })
  @IsString()
  reason: string;
}

/**
 * DTO for assigning a report to a moderator
 */
export class AssignReportDto {
  @ApiPropertyOptional({
    description: "Moderator ID to assign (defaults to self if not provided)",
  })
  @IsOptional()
  @IsUUID()
  moderatorId?: string;
}

/**
 * DTO for escalating a report
 */
export class EscalateReportDto {
  @ApiProperty({ description: "Reason for escalation" })
  @IsString()
  reason: string;
}

/**
 * Query DTO for moderation queue
 */
export class ModerationQueueQuery {
  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Items per page", default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: ModerationContentType,
    description: "Filter by content type",
  })
  @IsOptional()
  @IsEnum(ModerationContentType)
  contentType?: ModerationContentType;

  @ApiPropertyOptional({
    enum: ModerationStatus,
    description: "Filter by status",
  })
  @IsOptional()
  @IsEnum(ModerationStatus)
  status?: ModerationStatus;

  @ApiPropertyOptional({
    description: 'Filter by assigned moderator ID or "unassigned"',
  })
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional({
    enum: ["createdAt", "updatedAt", "priority"],
    description: "Sort by field",
  })
  @IsOptional()
  @IsString()
  sortBy?: "createdAt" | "updatedAt" | "priority" = "createdAt";

  @ApiPropertyOptional({ enum: ["ASC", "DESC"], description: "Sort order" })
  @IsOptional()
  @IsString()
  sortOrder?: "ASC" | "DESC" = "DESC";
}

/**
 * Query DTO for content flags
 */
export class ContentFlagQuery {
  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Items per page", default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: ModerationContentType,
    description: "Filter by content type",
  })
  @IsOptional()
  @IsEnum(ModerationContentType)
  contentType?: ModerationContentType;

  @ApiPropertyOptional({
    enum: ModerationStatus,
    description: "Filter by status",
  })
  @IsOptional()
  @IsEnum(ModerationStatus)
  status?: ModerationStatus;

  @ApiPropertyOptional({ description: "Filter by flag type" })
  @IsOptional()
  @IsString()
  flagType?: string;
}

/**
 * Query DTO for moderation logs
 */
export class ModerationLogQuery {
  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Items per page", default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: "Filter by moderator ID" })
  @IsOptional()
  @IsUUID()
  moderatorId?: string;

  @ApiPropertyOptional({
    enum: ModerationContentType,
    description: "Filter by content type",
  })
  @IsOptional()
  @IsEnum(ModerationContentType)
  contentType?: ModerationContentType;

  @ApiPropertyOptional({
    enum: ModerationAction,
    description: "Filter by action",
  })
  @IsOptional()
  @IsEnum(ModerationAction)
  action?: ModerationAction;

  @ApiPropertyOptional({ description: "Filter by target user ID" })
  @IsOptional()
  @IsUUID()
  targetUserId?: string;
}

/**
 * DTO for resolving auto-flag
 */
export class ResolveAutoFlagDto {
  @ApiProperty({
    enum: ModerationAction,
    description: "Action to take on the flagged content",
  })
  @IsEnum(ModerationAction)
  action: ModerationAction;

  @ApiPropertyOptional({ description: "Notes about the resolution" })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Query DTO for moderation statistics
 */
export class ModerationStatsQuery {
  @ApiPropertyOptional({
    enum: ["day", "week", "month"],
    description: "Time period",
    default: "day",
  })
  @IsOptional()
  @IsString()
  period?: "day" | "week" | "month" = "day";
}

// ============================================================================
// Mute DTOs
// ============================================================================

/**
 * DTO for issuing a mute to a user
 */
export class IssueMuteDto {
  @ApiProperty({ description: "ID of the user to mute" })
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: MuteScope, description: "Scope of the mute" })
  @IsEnum(MuteScope)
  scope: MuteScope;

  @ApiProperty({ enum: ReportReason, description: "Reason for the mute" })
  @IsEnum(ReportReason)
  reason: ReportReason;

  @ApiProperty({ description: "Detailed explanation of the mute" })
  @IsString()
  details: string;

  @ApiProperty({ description: "Duration in days" })
  @IsNumber()
  @Min(1)
  @Max(365)
  durationDays: number;
}

// ============================================================================
// Appeal DTOs
// ============================================================================

/**
 * DTO for creating a ban appeal
 */
export class CreateAppealDto {
  @ApiProperty({ description: "ID of the ban being appealed" })
  @IsUUID()
  banId: string;

  @ApiProperty({ description: "Reason for appeal" })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: "Additional context or evidence" })
  @IsOptional()
  @IsString()
  additionalContext?: string;
}

/**
 * DTO for reviewing an appeal
 */
export class ReviewAppealDto {
  @ApiProperty({ description: "Whether to approve the appeal" })
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional({ description: "Review notes" })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Query DTO for appeals queue
 */
export class AppealsQueueQuery {
  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Items per page", default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: AppealStatus, description: "Filter by status" })
  @IsOptional()
  @IsEnum(AppealStatus)
  status?: AppealStatus;
}

// ============================================================================
// Bulk Action DTOs
// ============================================================================

/**
 * DTO for bulk resolving reports
 */
export class BulkResolveDto {
  @ApiProperty({ description: "Report IDs to resolve" })
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  reportIds: string[];

  @ApiProperty({ enum: ModerationAction, description: "Action to take" })
  @IsEnum(ModerationAction)
  action: ModerationAction;

  @ApiPropertyOptional({ description: "Notes for all resolutions" })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * DTO for bulk assigning reports
 */
export class BulkAssignDto {
  @ApiProperty({ description: "Report IDs to assign" })
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  reportIds: string[];

  @ApiPropertyOptional({ description: "Moderator ID (defaults to self)" })
  @IsOptional()
  @IsUUID()
  moderatorId?: string;
}

/**
 * DTO for bulk issuing warnings
 */
export class BulkWarnDto {
  @ApiProperty({ description: "User IDs to warn" })
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  userIds: string[];

  @ApiProperty({ enum: ReportReason, description: "Reason for warning" })
  @IsEnum(ReportReason)
  reason: ReportReason;

  @ApiProperty({ description: "Warning message" })
  @IsString()
  message: string;
}
