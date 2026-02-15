import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from "typeorm";
import { NotificationType } from "@aardvark/shared";
import { User } from "./user.entity";

/**
 * Notification entity for user alerts and updates.
 */
@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column("uuid")
  userId: string;

  @ManyToOne(() => User, (user) => user.notifications, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({
    type: "enum",
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({ length: 200 })
  title: string;

  @Column({ type: "text" })
  message: string;

  @Column({ type: "jsonb", default: {} })
  data: Record<string, unknown>;

  @Column({ type: "varchar", nullable: true })
  linkUrl: string | null;

  @Index()
  @Column({ default: false })
  isRead: boolean;

  @Column({ type: "timestamptz", nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
