import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Content type for moderation
 */
export enum ModerationContentType {
  STORY = 'story',
  SEGMENT = 'segment',
  COMMENT = 'comment',
  RATING = 'rating',
  FORUM_THREAD = 'forum_thread',
  FORUM_POST = 'forum_post',
  MESSAGE = 'message',
  USER_PROFILE = 'user_profile',
}

/**
 * Report reason categories
 */
export enum ReportReason {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  HATE_SPEECH = 'hate_speech',
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  SEXUAL_CONTENT = 'sexual_content',
  SELF_HARM = 'self_harm',
  COPYRIGHT = 'copyright',
  VIOLENCE = 'violence',
  MISINFORMATION = 'misinformation',
  IMPERSONATION = 'impersonation',
  OTHER = 'other',
}

/**
 * Moderation status
 */
export enum ModerationStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ESCALATED = 'escalated',
  RESOLVED = 'resolved',
}

/**
 * Moderation action taken
 */
export enum ModerationAction {
  NONE = 'none',
  WARNING = 'warning',
  CONTENT_REMOVED = 'content_removed',
  CONTENT_EDITED = 'content_edited',
  USER_WARNED = 'user_warned',
  USER_TEMP_BAN = 'user_temp_ban',
  USER_PERM_BAN = 'user_perm_ban',
  USER_SHADOWBAN = 'user_shadowban',
  DISMISSED = 'dismissed',
}

/**
 * Report entity - user reports on content.
 */
@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  reporterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporterId' })
  reporter: User;

  @Index()
  @Column({
    type: 'enum',
    enum: ModerationContentType,
  })
  contentType: ModerationContentType;

  @Index()
  @Column('uuid')
  contentId: string;

  @Column('uuid', { nullable: true })
  contentAuthorId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'contentAuthorId' })
  contentAuthor: User | null;

  @Column({
    type: 'enum',
    enum: ReportReason,
  })
  reason: ReportReason;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: ModerationStatus,
    default: ModerationStatus.PENDING,
  })
  status: ModerationStatus;

  @Column('uuid', { nullable: true })
  assignedModeratorId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignedModeratorId' })
  assignedModerator: User | null;

  @Column({
    type: 'enum',
    enum: ModerationAction,
    default: ModerationAction.NONE,
  })
  actionTaken: ModerationAction;

  @Column({ type: 'text', nullable: true })
  moderatorNotes: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

/**
 * Moderation log entity - tracks all moderation actions.
 */
@Entity('moderation_logs')
export class ModerationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  moderatorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'moderatorId' })
  moderator: User;

  @Column({
    type: 'enum',
    enum: ModerationAction,
  })
  action: ModerationAction;

  @Column({
    type: 'enum',
    enum: ModerationContentType,
  })
  contentType: ModerationContentType;

  @Column('uuid')
  contentId: string;

  @Column('uuid', { nullable: true })
  targetUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'targetUserId' })
  targetUser: User | null;

  @Column('uuid', { nullable: true })
  reportId: string | null;

  @ManyToOne(() => Report, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reportId' })
  report: Report | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

/**
 * User warning entity - tracks warnings issued to users.
 */
@Entity('user_warnings')
export class UserWarning {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  issuedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'issuedById' })
  issuedBy: User;

  @Column({
    type: 'enum',
    enum: ReportReason,
  })
  reason: ReportReason;

  @Column({ type: 'text' })
  message: string;

  @Column('uuid', { nullable: true })
  reportId: string | null;

  @ManyToOne(() => Report, { nullable: true })
  @JoinColumn({ name: 'reportId' })
  report: Report | null;

  @Column({ default: false })
  acknowledged: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  acknowledgedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

/**
 * User ban entity - tracks user bans.
 */
@Entity('user_bans')
export class UserBan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  issuedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'issuedById' })
  issuedBy: User;

  @Column({
    type: 'enum',
    enum: ReportReason,
  })
  reason: ReportReason;

  @Column({ type: 'text' })
  details: string;

  @Column({ default: false })
  isPermanent: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ default: false })
  isShadowban: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  liftedAt: Date | null;

  @Column('uuid', { nullable: true })
  liftedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'liftedById' })
  liftedBy: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

/**
 * Content flag entity - auto-flagged content by ML/filters.
 */
@Entity('content_flags')
export class ContentFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ModerationContentType,
  })
  contentType: ModerationContentType;

  @Index()
  @Column('uuid')
  contentId: string;

  @Column('uuid', { nullable: true })
  authorId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'authorId' })
  author: User | null;

  @Column({ length: 50 })
  flagType: string; // 'profanity', 'spam', 'hate_speech', etc.

  @Column({ type: 'decimal', precision: 4, scale: 3 })
  confidence: number; // 0.000 to 1.000

  @Column({ type: 'text', nullable: true })
  matchedPatterns: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: ModerationStatus,
    default: ModerationStatus.PENDING,
  })
  status: ModerationStatus;

  @Column({ default: false })
  isAutoResolved: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
