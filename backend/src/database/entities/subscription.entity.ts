import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from "typeorm";
import { SubscriptionTier, SubscriptionInterval } from "@aardvark/shared";
import { User } from "./user.entity";

/**
 * Subscription plan entity - defines available subscription options
 */
@Entity("subscription_plans")
export class SubscriptionPlan {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: SubscriptionTier,
  })
  tier: SubscriptionTier;

  @Column({
    type: "enum",
    enum: SubscriptionInterval,
  })
  interval: SubscriptionInterval;

  @Column()
  name: string;

  @Column({ type: "text" })
  description: string;

  @Column()
  priceInCents: number;

  @Column({ default: "usd" })
  currency: string;

  @Column()
  stripePriceId: string;

  @Column("text", { array: true, default: [] })
  features: string[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}

/**
 * User subscription entity - tracks active subscriptions
 */
@Entity("subscriptions")
export class Subscription {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column("uuid")
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column("uuid")
  planId: string;

  @ManyToOne(() => SubscriptionPlan)
  @JoinColumn({ name: "planId" })
  plan: SubscriptionPlan;

  @Index()
  @Column({ nullable: true })
  stripeSubscriptionId: string | null;

  @Column({ nullable: true })
  stripeCustomerId: string | null;

  // Mobile subscription support
  @Column({ type: "varchar", length: 20, nullable: true })
  platform: "web" | "ios" | "android" | null;

  @Column({ nullable: true })
  platformSubscriptionId: string | null;

  @Index()
  @Column({
    type: "varchar",
    length: 20,
    default: "active",
  })
  status: "active" | "canceled" | "past_due" | "trialing" | "unpaid";

  @Column({ type: "timestamptz" })
  currentPeriodStart: Date;

  @Column({ type: "timestamptz" })
  currentPeriodEnd: Date;

  @Column({ default: false })
  cancelAtPeriodEnd: boolean;

  @Column({ type: "timestamptz", nullable: true })
  canceledAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  trialStart: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  trialEnd: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
