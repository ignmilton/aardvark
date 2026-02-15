import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

/**
 * AdReward entity for tracking ad watches and credit rewards.
 * Records each rewarded ad view with provider, type, and credits awarded.
 */
@Entity("ad_rewards")
@Index(["userId", "watchedAt"])
export class AdReward {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column("uuid")
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ length: 50 })
  adProvider: string; // 'admob', 'unity', 'applovin', etc.

  @Column({ length: 50 })
  adType: string; // 'rewarded_video', 'interstitial', 'rewarded_interstitial'

  @Column({ type: "int" })
  creditsAwarded: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  adUnitId: string | null;

  @Column({ type: "jsonb", nullable: true })
  adMetadata: Record<string, any> | null;

  // Session tracking for rate limiting
  @Column({ type: "varchar", length: 255, nullable: true })
  sessionId: string | null;

  // Device info for fraud prevention
  @Column({ type: "varchar", length: 50, nullable: true })
  platform: string | null; // 'ios', 'android', 'web'

  @Column({ type: "varchar", length: 100, nullable: true })
  deviceId: string | null;

  @Column({ type: "inet", nullable: true })
  ipAddress: string | null;

  // Verification status
  @Column({ default: false })
  verified: boolean;

  @Column({ type: "varchar", length: 255, nullable: true })
  verificationToken: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  watchedAt: Date;
}
