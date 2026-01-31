import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Story } from './story.entity';
import { StorySegment } from './story-segment.entity';

/**
 * Impression type for tracking reader engagement
 */
export enum ImpressionType {
  VIEW = 'view', // Story page view
  READ_START = 'read_start', // Started reading
  READ_SEGMENT = 'read_segment', // Read a segment
  READ_COMPLETE = 'read_complete', // Completed story
}

/**
 * Impression entity for tracking story views and reads.
 * Used for analytics and revenue sharing calculations.
 */
@Entity('impressions')
@Index(['storyId', 'createdAt'])
@Index(['userId', 'createdAt'])
export class Impression {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  storyId: string;

  @ManyToOne(() => Story, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storyId' })
  story: Story;

  // Can be null for anonymous users
  @Column('uuid', { nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  // Session tracking for anonymous users
  @Column({ type: 'varchar', nullable: true })
  sessionId: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: ImpressionType,
  })
  type: ImpressionType;

  // For segment reads, track which segment
  @Column('uuid', { nullable: true })
  segmentId: string | null;

  @ManyToOne(() => StorySegment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'segmentId' })
  segment: StorySegment | null;

  // Duration tracking (for read impressions)
  @Column({ type: 'varchar', nullable: true })
  durationSeconds: number | null;

  // Revenue attribution
  @Column({ default: false })
  isRevenueEligible: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  revenueAmount: number;

  // Request metadata
  @Column({ type: 'varchar', nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  countryCode: string | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

/**
 * Payout status for author revenue
 */
export enum PayoutStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PAID = 'paid',
  FAILED = 'failed',
}

/**
 * AuthorRevenue entity for tracking author earnings.
 * Aggregates impressions by period for revenue calculation.
 */
@Entity('author_revenue')
@Index(['authorId', 'periodStart', 'periodEnd'])
export class AuthorRevenue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Index()
  @Column('uuid')
  storyId: string;

  @ManyToOne(() => Story, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storyId' })
  story: Story;

  // Revenue period
  @Column({ type: 'date' })
  periodStart: Date;

  @Column({ type: 'date' })
  periodEnd: Date;

  // Metrics
  @Column({ default: 0 })
  totalImpressions: number;

  @Column({ default: 0 })
  uniqueReaders: number;

  @Column({ default: 0 })
  completions: number;

  // Revenue calculation
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  grossRevenue: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 70 })
  revenueSharePercent: number; // Default 70% to author

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  netRevenue: number;

  // Payout tracking
  @Column({
    type: 'enum',
    enum: PayoutStatus,
    default: PayoutStatus.PENDING,
  })
  payoutStatus: PayoutStatus;

  @Column('uuid', { nullable: true })
  payoutId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
