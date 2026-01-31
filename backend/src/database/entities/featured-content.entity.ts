import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Story } from './story.entity';
import { Collection } from './collection.entity';

/**
 * Featured content type for editorial picks
 */
export enum FeaturedType {
  STORY = 'story',
  COLLECTION = 'collection',
  AUTHOR_SPOTLIGHT = 'author_spotlight',
  NEW_RELEASES = 'new_releases',
  EDITORS_PICK = 'editors_pick',
}

/**
 * Placement options for featured content
 */
export enum FeaturedPlacement {
  HOMEPAGE_HERO = 'homepage_hero',
  HOMEPAGE_CAROUSEL = 'homepage_carousel',
  CATEGORY_SPOTLIGHT = 'category_spotlight',
  SIDEBAR = 'sidebar',
}

/**
 * FeaturedContent entity for editorial picks and promotions.
 * Admins can feature stories, collections, or authors on various
 * parts of the platform.
 */
@Entity('featured_content')
export class FeaturedContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({
    type: 'enum',
    enum: FeaturedType,
  })
  type: FeaturedType;

  // Can feature a story
  @Column('uuid', { nullable: true })
  storyId: string | null;

  @ManyToOne(() => Story, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storyId' })
  story: Story | null;

  // Or a collection
  @Column('uuid', { nullable: true })
  collectionId: string | null;

  @ManyToOne(() => Collection, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collectionId' })
  collection: Collection | null;

  // Or spotlight an author
  @Column('uuid', { nullable: true })
  authorId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User | null;

  // Display settings
  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  bannerImageUrl: string | null;

  // Scheduling
  @Index()
  @Column({ type: 'timestamptz' })
  startDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endDate: Date | null;

  @Index()
  @Column({ default: true })
  isActive: boolean;

  // Position/priority (higher = more prominent)
  @Column({ default: 0 })
  priority: number;

  @Column({
    type: 'enum',
    enum: FeaturedPlacement,
    default: FeaturedPlacement.HOMEPAGE_CAROUSEL,
  })
  placement: FeaturedPlacement;

  // Created by admin/moderator
  @Column('uuid')
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
