import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  Index,
  JoinColumn,
} from 'typeorm';
import {
  StoryCategory,
  CollaborationMode,
  StoryStatus,
  ContentWarning,
  StoryLength,
  StoryComplexity,
} from '@aardvark/shared';
import { User } from './user.entity';
import { StorySegment } from './story-segment.entity';
import { ReaderProgress } from './reader-progress.entity';
import { Comment } from './comment.entity';
import { Rating } from './rating.entity';
import { Tag } from './tag.entity';

/**
 * Story entity representing an interactive fiction story.
 * Stories contain multiple segments connected by choices,
 * creating branching narratives.
 */
@Entity('stories')
export class Story {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  authorId: string;

  @ManyToOne(() => User, (user) => user.stories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Index()
  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  synopsis: string | null;

  @Column({ nullable: true })
  coverImageUrl: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: StoryCategory,
    default: StoryCategory.OTHER,
  })
  category: StoryCategory;

  @Column('text', { array: true, default: [] })
  tags: string[];

  @Column({
    type: 'enum',
    enum: ContentWarning,
    array: true,
    default: [],
  })
  contentWarnings: ContentWarning[];

  @Column({
    type: 'enum',
    enum: CollaborationMode,
    default: CollaborationMode.PRIVATE,
  })
  collaborationMode: CollaborationMode;

  @Index()
  @Column({
    type: 'enum',
    enum: StoryStatus,
    default: StoryStatus.DRAFT,
  })
  status: StoryStatus;

  @Index()
  @Column({ default: false })
  isPremium: boolean;

  @Column({ default: 0 })
  creditCost: number;

  @Column({ default: false })
  nsfwFlag: boolean;

  @Column({ length: 10, default: 'en' })
  language: string;

  @Column({ default: 0 })
  estimatedReadTime: number;

  @Column({
    type: 'enum',
    enum: StoryLength,
    default: StoryLength.SHORT,
  })
  length: StoryLength;

  @Column({
    type: 'enum',
    enum: StoryComplexity,
    default: StoryComplexity.LINEAR,
  })
  complexity: StoryComplexity;

  @Column('uuid', { nullable: true })
  rootSegmentId: string | null;

  @Column({ default: 1 })
  currentVersion: number;

  @Index()
  @Column({ default: 0 })
  viewCount: number;

  @Column({ default: 0 })
  uniqueReaders: number;

  @Index()
  @Column({ type: 'decimal', precision: 2, scale: 1, default: 0 })
  averageRating: number;

  @Column({ default: 0 })
  ratingsCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  completionRate: number;

  @Column({ type: 'timestamptz', nullable: true })
  featuredAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => StorySegment, (segment) => segment.story)
  segments: StorySegment[];

  @OneToMany(() => ReaderProgress, (progress) => progress.story)
  readerProgress: ReaderProgress[];

  @OneToMany(() => Comment, (comment) => comment.story)
  comments: Comment[];

  @OneToMany(() => Rating, (rating) => rating.story)
  ratings: Rating[];


  @ManyToMany(() => Tag, (tag) => tag.stories)
  @JoinTable({
    name: 'story_tags',
    joinColumn: { name: 'storyId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tagId', referencedColumnName: 'id' },
  })
  storyTags: Tag[];

  /**
   * Check if story is publicly readable
   */
  get isPublic(): boolean {
    return this.status === StoryStatus.PUBLISHED;
  }

  /**
   * Check if story allows community contributions
   */
  get allowsContributions(): boolean {
    return (
      this.collaborationMode === CollaborationMode.MODERATED ||
      this.collaborationMode === CollaborationMode.OPEN
    );
  }
}
