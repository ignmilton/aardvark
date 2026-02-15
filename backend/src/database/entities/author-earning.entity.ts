import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from "typeorm";
import { EarningType } from "@aardvark/shared";
import { User } from "./user.entity";
import { Story } from "./story.entity";
import { Transaction } from "./transaction.entity";

/**
 * Author earning entity - tracks author revenue from story unlocks, tips, etc.
 */
@Entity("author_earnings")
export class AuthorEarning {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column("uuid")
  authorId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "authorId" })
  author: User;

  @Column("uuid", { nullable: true })
  storyId: string | null;

  @ManyToOne(() => Story, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "storyId" })
  story: Story | null;

  @Index()
  @Column({
    type: "enum",
    enum: EarningType,
  })
  type: EarningType;

  @Column()
  grossAmount: number;

  @Column()
  platformFee: number;

  @Column()
  netAmount: number;

  @Column("uuid", { nullable: true })
  readerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "readerUserId" })
  reader: User | null;

  @Column("uuid")
  transactionId: string;

  @ManyToOne(() => Transaction)
  @JoinColumn({ name: "transactionId" })
  transaction: Transaction;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}

/**
 * Author payout account entity - Stripe Connect or UPI account for receiving payouts
 */
@Entity("author_payout_accounts")
export class AuthorPayoutAccount {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column("uuid", { unique: true })
  authorId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "authorId" })
  author: User;

  // Stripe Connect fields
  @Column({ type: "varchar", nullable: true })
  stripeConnectAccountId: string | null;

  @Column({
    type: "varchar",
    length: 20,
    default: "pending",
  })
  accountStatus: "pending" | "active" | "restricted" | "disabled";

  @Column({ default: false })
  chargesEnabled: boolean;

  @Column({ default: false })
  payoutsEnabled: boolean;

  @Column({ length: 2 })
  country: string;

  @Column({ length: 3, default: "usd" })
  currency: string;

  // UPI Payout fields (India)
  @Column({ type: "varchar", nullable: true, length: 100 })
  upiVpa: string | null; // e.g., "username@upi", "phone@paytm"

  @Column({ type: "varchar", nullable: true, length: 100 })
  upiAccountHolderName: string | null;

  @Column({ default: false })
  upiVerified: boolean;

  @Column({ type: "varchar", nullable: true })
  razorpayFundAccountId: string | null; // Razorpay X fund account for payouts

  @Column({ type: "varchar", nullable: true })
  razorpayContactId: string | null; // Razorpay X contact ID

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @Column({ type: "timestamptz" })
  updatedAt: Date;
}

/**
 * Payout entity - tracks payout requests and status (Stripe or UPI)
 */
@Entity("payouts")
export class Payout {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column("uuid")
  authorId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "authorId" })
  author: User;

  @Column()
  amount: number;

  @Column({ length: 3, default: "usd" })
  currency: string;

  @Column({
    type: "varchar",
    length: 20,
    default: "stripe",
  })
  paymentMethod: "stripe" | "upi";

  @Index()
  @Column({
    type: "varchar",
    length: 20,
    default: "pending",
  })
  status: "pending" | "processing" | "completed" | "failed" | "reversed";

  // Stripe fields
  @Column({ type: "varchar", nullable: true })
  stripeTransferId: string | null;

  @Column({ type: "varchar", nullable: true })
  stripePayoutId: string | null;

  // UPI/Razorpay fields
  @Column({ type: "varchar", nullable: true })
  razorpayPayoutId: string | null;

  @Column({ type: "varchar", nullable: true, length: 100 })
  upiVpa: string | null;

  @Column({ type: "varchar", nullable: true })
  utr: string | null; // Unique Transaction Reference for UPI

  @Column({ type: "text", nullable: true })
  failureReason: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  requestedAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  processedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  completedAt: Date | null;
}

/**
 * UPI Payment Order entity - tracks UPI payment orders from users
 */
@Entity("upi_payment_orders")
export class UPIPaymentOrder {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  razorpayOrderId: string;

  @Index()
  @Column("uuid")
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column()
  amountInPaise: number; // Amount in paise (₹1 = 100 paise)

  @Column({ length: 3, default: "INR" })
  currency: string;

  @Index()
  @Column({
    type: "varchar",
    length: 20,
    default: "created",
  })
  status:
    | "created"
    | "pending"
    | "authorized"
    | "captured"
    | "failed"
    | "refunded";

  @Column({
    type: "varchar",
    length: 20,
  })
  purpose: "credit_purchase" | "subscription";

  @Column("uuid")
  referenceId: string; // bundleId or planId

  @Column({ type: "varchar", nullable: true })
  razorpayPaymentId: string | null;

  @Column({ type: "varchar", nullable: true, length: 100 })
  vpa: string | null; // UPI VPA used for payment

  @Column({ type: "varchar", nullable: true, length: 20 })
  method: string | null; // 'upi', 'card', 'netbanking', etc.

  @Column({ length: 50 })
  receipt: string;

  @Column({ type: "jsonb", default: {} })
  notes: Record<string, string>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  paidAt: Date | null;
}
