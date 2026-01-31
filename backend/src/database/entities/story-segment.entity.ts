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
} from 'typeorm';
import { User } from './user.entity';
import { Story } from './story.entity';
import { Choice } from './choice.entity';

/**
 * Story segment entity representing a single node/chapter
 * in the branching narrative structure.
 */
@Entity('story_segments')
export class StorySegment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  storyId: string;

  @ManyToOne(() => Story, (story) => story.segments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storyId' })
  story: Story;

  @Index()
  @Column('uuid')
  authorId: string;

  @ManyToOne(() => User, (user) => user.segments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  contentMarkdown: string | null;

  // Visual editor positioning
  @Column({ type: 'jsonb', default: { x: 0, y: 0 } })
  position: { x: number; y: number };

  // Parent segments (segments that can lead to this one)
  @Column('uuid', { array: true, default: [] })
  parentSegmentIds: string[];

  @Column({ default: false })
  isRootSegment: boolean;

  @Column({ default: false })
  isEnding: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  endingType: 'good' | 'bad' | 'neutral' | 'secret' | null;


  // Metadata
  @Column({ default: 0 })
  wordCount: number;

  @Column({ default: 0 })
  estimatedReadTime: number;

  @Column({ default: 0 })
  readCount: number;

  // Version control
  @Column({ default: 1 })
  version: number;

  @Column('uuid', { nullable: true })
  previousVersionId: string | null;

  // Collaboration
  @Column('uuid', { nullable: true })
  submittedByUserId: string | null;

  @Column('uuid', { nullable: true })
  approvedByUserId: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  approvalStatus: 'pending' | 'approved' | 'rejected' | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Choice, (choice) => choice.segment)
  choices: Choice[];

  @OneToMany(() => Choice, (choice) => choice.nextSegment)
  incomingChoices: Choice[];
}
