import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

/**
 * Conversation entity for grouping messages between two users.
 * Defined first to avoid forward reference issues.
 */
@Entity("conversations")
export class Conversation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column("uuid")
  participant1Id: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "participant1Id" })
  participant1: User;

  @Index()
  @Column("uuid")
  participant2Id: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "participant2Id" })
  participant2: User;

  @Column({ type: "text", nullable: true })
  lastMessagePreview: string | null;

  @Column({ type: "timestamptz", nullable: true })
  lastMessageAt: Date | null;

  @Column({ default: 0 })
  unreadCount1: number; // Unread for participant1

  @Column({ default: 0 })
  unreadCount2: number; // Unread for participant2

  @Column({ default: false })
  isBlocked1: boolean; // Blocked by participant1

  @Column({ default: false })
  isBlocked2: boolean; // Blocked by participant2

  @Column({ default: false })
  isArchived1: boolean;

  @Column({ default: false })
  isArchived2: boolean;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}

/**
 * Message entity for private messaging between users.
 * Supports threaded conversations with read receipts.
 */
@Entity("messages")
export class Message {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column("uuid")
  senderId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "senderId" })
  sender: User;

  @Index()
  @Column("uuid")
  recipientId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "recipientId" })
  recipient: User;

  @Index()
  @Column("uuid")
  conversationId: string;

  @ManyToOne(() => Conversation, (conv) => conv.messages, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "conversationId" })
  conversation: Conversation;

  @Column({ type: "text" })
  content: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: "timestamptz", nullable: true })
  readAt: Date | null;

  @Column({ default: false })
  isDeleted: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}

/**
 * User block entity for tracking blocked users.
 */
@Entity("user_blocks")
export class UserBlock {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column("uuid")
  blockerId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "blockerId" })
  blocker: User;

  @Index()
  @Column("uuid")
  blockedId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "blockedId" })
  blocked: User;

  @Column({ type: "text", nullable: true })
  reason: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
