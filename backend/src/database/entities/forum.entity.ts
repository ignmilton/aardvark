import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

/**
 * Forum category enum
 */
export enum ForumCategory {
  GENERAL = "general",
  WRITING_TIPS = "writing_tips",
  STORY_DISCUSSIONS = "story_discussions",
  FEEDBACK = "feedback",
  ANNOUNCEMENTS = "announcements",
  HELP = "help",
  OFF_TOPIC = "off_topic",
}

/**
 * Forum thread entity - represents a discussion topic.
 */
@Entity("forum_threads")
export class ForumThread {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({
    type: "enum",
    enum: ForumCategory,
    default: ForumCategory.GENERAL,
  })
  category: ForumCategory;

  @Index()
  @Column("uuid")
  authorId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "authorId" })
  author: User;

  @Column({ length: 200 })
  title: string;

  @Column({ type: "text" })
  content: string;

  @Column({ default: false })
  isPinned: boolean;

  @Column({ default: false })
  isLocked: boolean;

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ default: 0 })
  viewCount: number;

  @Column({ default: 0 })
  replyCount: number;

  @Column({ type: "timestamptz", nullable: true })
  lastReplyAt: Date | null;

  @Column("uuid", { nullable: true })
  lastReplyUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "lastReplyUserId" })
  lastReplyUser: User | null;

  @OneToMany(() => ForumPost, (post) => post.thread)
  posts: ForumPost[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}

/**
 * Forum post entity - represents a reply in a thread.
 */
@Entity("forum_posts")
export class ForumPost {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column("uuid")
  threadId: string;

  @ManyToOne(() => ForumThread, (thread) => thread.posts, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "threadId" })
  thread: ForumThread;

  @Index()
  @Column("uuid")
  authorId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "authorId" })
  author: User;

  @Column({ type: "text" })
  content: string;

  @Column("uuid", { nullable: true })
  replyToId: string | null;

  @ManyToOne(() => ForumPost, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "replyToId" })
  replyTo: ForumPost | null;

  @Column({ default: 0 })
  upvotes: number;

  @Column({ default: 0 })
  downvotes: number;

  @Column({ default: false })
  isEdited: boolean;

  @Column({ default: false })
  isDeleted: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}

/**
 * Forum vote entity - tracks upvotes/downvotes on posts.
 */
@Entity("forum_votes")
export class ForumVote {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column("uuid")
  postId: string;

  @ManyToOne(() => ForumPost, { onDelete: "CASCADE" })
  @JoinColumn({ name: "postId" })
  post: ForumPost;

  @Index()
  @Column("uuid")
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "smallint" }) // 1 for upvote, -1 for downvote
  value: number;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}

/**
 * User reputation entity - tracks forum reputation.
 */
@Entity("user_reputations")
export class UserReputation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index({ unique: true })
  @Column("uuid")
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ default: 0 })
  score: number;

  @Column({ default: 0 })
  threadsCreated: number;

  @Column({ default: 0 })
  postsCreated: number;

  @Column({ default: 0 })
  upvotesReceived: number;

  @Column({ default: 0 })
  downvotesReceived: number;

  @Column({ default: 0 })
  helpfulAnswers: number;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
