import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from "typeorm";
import { User } from "./user.entity";
import { Comment } from "./comment.entity";

/**
 * Tracks individual user likes on comments to prevent duplicate likes.
 */
@Entity("comment_likes")
@Unique(["userId", "commentId"])
export class CommentLike {
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
  commentId: string;

  @ManyToOne(() => Comment, { onDelete: "CASCADE" })
  @JoinColumn({ name: "commentId" })
  comment: Comment;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
