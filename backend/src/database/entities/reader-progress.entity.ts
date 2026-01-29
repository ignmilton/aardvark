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
} from 'typeorm';
import { User } from './user.entity';
import { Story } from './story.entity';

/**
 * Reader progress entity tracking a user's journey through a story.
 * Stores current position, visited segments, choice history, and state.
 */
@Entity('reader_progress')
@Unique(['userId', 'storyId'])
export class ReaderProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, (user) => user.readingProgress, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column('uuid')
  storyId: string;

  @ManyToOne(() => Story, (story) => story.readerProgress, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storyId' })
  story: Story;

  @Column('uuid')
  currentSegmentId: string;

  // All segments the reader has visited
  @Column('uuid', { array: true, default: [] })
  visitedSegmentIds: string[];

  // All choices the reader has made
  @Column({ type: 'jsonb', default: [] })
  choiceHistory: {
    segmentId: string;
    choiceId: string;
    timestamp: Date;
  }[];


  // Reading statistics
  @Column({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz' })
  lastReadAt: Date;

  @Column({ default: 0 })
  totalReadTime: number;

  @Column({ default: false })
  isCompleted: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column('uuid', { nullable: true })
  reachedEndingId: string | null;

  // Bookmarks within the story
  @Column({ type: 'jsonb', default: [] })
  bookmarks: {
    segmentId: string;
    note: string;
    createdAt: Date;
  }[];

  // Purchase tracking for premium stories
  @Column({ default: false })
  hasPurchased: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  purchasedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
