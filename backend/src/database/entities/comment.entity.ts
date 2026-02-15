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
import { Story } from "./story.entity";

/**
 * Comment entity for threaded discussions on stories.
 */
@Entity("comments")
export class Comment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column("uuid")
  userId: string;

  @ManyToOne(() => User, (user) => user.comments, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Index()
  @Column("uuid")
  storyId: string;

  @ManyToOne(() => Story, (story) => story.comments, { onDelete: "CASCADE" })
  @JoinColumn({ name: "storyId" })
  story: Story;

  @Column("uuid", { nullable: true })
  segmentId: string | null;

  @Column("uuid", { nullable: true })
  parentCommentId: string | null;

  @ManyToOne(() => Comment, (comment) => comment.replies, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "parentCommentId" })
  parentComment: Comment | null;

  @OneToMany(() => Comment, (comment) => comment.parentComment)
  replies: Comment[];

  @Column({ type: "text" })
  content: string;

  @Column({ type: "text" })
  contentHtml: string;

  @Column({ default: 0 })
  likesCount: number;

  @Column({ default: 0 })
  repliesCount: number;

  @Column({ default: false })
  isEdited: boolean;

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ type: "timestamptz", nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
