import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";
import { UserBan } from "./moderation.entity";

/**
 * Appeal status
 */
export enum AppealStatus {
  PENDING = "pending",
  UNDER_REVIEW = "under_review",
  APPROVED = "approved",
  REJECTED = "rejected",
}

/**
 * BanAppeal entity - user appeals for ban reversals.
 */
@Entity("ban_appeals")
export class BanAppeal {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column("uuid")
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Index()
  @Column("uuid")
  banId: string;

  @ManyToOne(() => UserBan, { onDelete: "CASCADE" })
  @JoinColumn({ name: "banId" })
  ban: UserBan;

  @Column({ type: "text" })
  reason: string;

  @Column({ type: "text", nullable: true })
  additionalContext: string | null;

  @Index()
  @Column({
    type: "enum",
    enum: AppealStatus,
    default: AppealStatus.PENDING,
  })
  status: AppealStatus;

  @Column("uuid", { nullable: true })
  reviewedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "reviewedById" })
  reviewedBy: User | null;

  @Column({ type: "text", nullable: true })
  reviewNotes: string | null;

  @Column({ type: "timestamptz", nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
