import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import {
  UserRole,
  AccountStatus,
  SubscriptionStatus,
  UserPreferences,
  DEFAULT_USER_PREFERENCES,
} from '@aardvark/shared';
import { Story } from './story.entity';
import { StorySegment } from './story-segment.entity';
import { ReaderProgress } from './reader-progress.entity';
import { Comment } from './comment.entity';
import { Rating } from './rating.entity';
import { Transaction } from './transaction.entity';
import { Notification } from './notification.entity';

/**
 * User entity representing registered accounts in the platform.
 * Supports multiple roles from reader to admin with various
 * subscription and account statuses.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 30 })
  username: string;

  @Index({ unique: true })
  @Column({ length: 255 })
  email: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ length: 100, nullable: true })
  displayName: string | null;

  @Column({ nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ nullable: true })
  websiteUrl: string | null;

  @Column({ type: 'jsonb', default: {} })
  socialLinks: Record<string, string>;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.READER,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: AccountStatus,
    default: AccountStatus.PENDING_VERIFICATION,
  })
  accountStatus: AccountStatus;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.NONE,
  })
  subscriptionStatus: SubscriptionStatus;

  @Column({ type: 'timestamptz', nullable: true })
  subscriptionExpiresAt: Date | null;

  @Column({ default: 0 })
  creditsBalance: number;

  // Revenue tracking for authors
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  pendingRevenue: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalEarnings: number;

  @Column({ type: 'jsonb', default: DEFAULT_USER_PREFERENCES })
  preferences: UserPreferences;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true, select: false })
  emailVerificationToken: string | null;

  @Column({ type: 'timestamptz', nullable: true, select: false })
  emailVerificationExpires: Date | null;

  @Column({ nullable: true, select: false })
  passwordResetToken: string | null;

  @Column({ type: 'timestamptz', nullable: true, select: false })
  passwordResetExpires: Date | null;

  @Column({ default: false })
  twoFactorEnabled: boolean;

  @Column({ nullable: true, select: false })
  twoFactorSecret: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @Column({ nullable: true })
  lastLoginIp: string | null;

  @Column({ default: 0 })
  loginAttempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  lockoutUntil: Date | null;

  // Stripe integration
  @Column({ nullable: true })
  stripeCustomerId: string | null;

  @Column({ nullable: true })
  stripeConnectAccountId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Story, (story) => story.author)
  stories: Story[];

  @OneToMany(() => StorySegment, (segment) => segment.author)
  segments: StorySegment[];

  @OneToMany(() => ReaderProgress, (progress) => progress.user)
  readingProgress: ReaderProgress[];

  @OneToMany(() => Comment, (comment) => comment.user)
  comments: Comment[];

  @OneToMany(() => Rating, (rating) => rating.user)
  ratings: Rating[];

  @OneToMany(() => Transaction, (transaction) => transaction.user)
  transactions: Transaction[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];

  /**
   * Check if user has premium subscription
   */
  get isPremium(): boolean {
    return (
      this.subscriptionStatus === SubscriptionStatus.ACTIVE &&
      (this.subscriptionExpiresAt === null ||
        this.subscriptionExpiresAt > new Date())
    );
  }

  /**
   * Check if user can perform author actions
   */
  get canAuthor(): boolean {
    return (
      this.role === UserRole.AUTHOR ||
      this.role === UserRole.MODERATOR ||
      this.role === UserRole.ADMIN
    );
  }

  /**
   * Check if user can perform moderation actions
   */
  get canModerate(): boolean {
    return this.role === UserRole.MODERATOR || this.role === UserRole.ADMIN;
  }
}
