import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Story } from './story.entity';

/**
 * Collection entity for user-curated story playlists.
 * Users can create public or private collections to organize stories.
 */
@Entity('collections')
export class Collection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ length: 100 })
  name: string;

  @Index({ unique: true })
  @Column({ length: 120 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  coverImageUrl: string | null;

  // Owner
  @Index()
  @Column('uuid')
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  // Visibility
  @Index()
  @Column({ default: true })
  isPublic: boolean;

  // Stories in collection
  @OneToMany(() => CollectionStory, (cs) => cs.collection)
  collectionStories: CollectionStory[];

  // Followers count (denormalized for performance)
  @Column({ default: 0 })
  followerCount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

/**
 * Join table for Collection-Story with ordering and curator notes
 */
@Entity('collection_stories')
@Index(['collectionId', 'storyId'], { unique: true })
export class CollectionStory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  collectionId: string;

  @ManyToOne(() => Collection, (collection) => collection.collectionStories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'collectionId' })
  collection: Collection;

  @Index()
  @Column('uuid')
  storyId: string;

  @ManyToOne(() => Story, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storyId' })
  story: Story;

  // Display order within the collection
  @Column({ default: 0 })
  order: number;

  // Optional curator note about why this story is in the collection
  @Column({ type: 'text', nullable: true })
  curatorNote: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  addedAt: Date;
}

/**
 * Collection followers join table
 */
@Entity('collection_followers')
@Index(['collectionId', 'userId'], { unique: true })
export class CollectionFollower {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  collectionId: string;

  @ManyToOne(() => Collection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collectionId' })
  collection: Collection;

  @Index()
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn({ type: 'timestamptz' })
  followedAt: Date;
}
