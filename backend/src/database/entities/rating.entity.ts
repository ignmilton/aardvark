import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
  Unique,
} from "typeorm";
import { User } from "./user.entity";
import { Story } from "./story.entity";

/**
 * Rating and review entity for story feedback.
 */
@Entity("ratings")
@Unique(["userId", "storyId"])
export class Rating {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column("uuid")
  userId: string;

  @ManyToOne(() => User, (user) => user.ratings, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Index()
  @Column("uuid")
  storyId: string;

  @ManyToOne(() => Story, (story) => story.ratings, { onDelete: "CASCADE" })
  @JoinColumn({ name: "storyId" })
  story: Story;

  @Column({ type: "decimal", precision: 2, scale: 1 })
  rating: number;

  @Column({ type: "varchar", length: 200, nullable: true })
  reviewTitle: string | null;

  @Column({ type: "text", nullable: true })
  reviewText: string | null;

  @Column({ type: "text", nullable: true })
  reviewHtml: string | null;

  @Column({ default: 0 })
  helpfulCount: number;

  @Column({ default: false })
  isVerifiedReader: boolean;

  @Column({ default: false })
  isEdited: boolean;

  @Column({ default: false })
  isFeatured: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
