import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Story } from './story.entity';
import { StorySegment } from './story-segment.entity';

/**
 * Branch submission status
 */
export type BranchSubmissionStatus = 'pending' | 'approved' | 'rejected' | 'revision_requested';

/**
 * Branch submission entity for collaborative story contributions.
 * Allows users to submit new branches to stories with moderated/open collaboration.
 */
@Entity('branch_submissions')
export class BranchSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  storyId: string;

  @ManyToOne(() => Story, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storyId' })
  story: Story;

  @Index()
  @Column('uuid')
  parentSegmentId: string;

  @ManyToOne(() => StorySegment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentSegmentId' })
  parentSegment: StorySegment;

  @Index()
  @Column('uuid')
  submittedByUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submittedByUserId' })
  submittedBy: User;

  // The submitted segment data (stored as JSON until approved)
  @Column({ type: 'jsonb' })
  segmentData: {
    title: string | null;
    content: string;
    contentMarkdown: string | null;
    isEnding: boolean;
    endingType: 'good' | 'bad' | 'neutral' | 'secret' | null;
    stateEffects: any[];
  };

  // Choices to connect from the parent segment to this new segment
  @Column({ type: 'jsonb', default: [] })
  choicesData: {
    choiceText: string;
    order: number;
    conditions: any[];
  }[];

  @Column({ type: 'text' })
  submissionNote: string;

  @Index()
  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status: BranchSubmissionStatus;

  // Reasons content filter flagged this submission (if any)
  @Column({ type: 'jsonb', nullable: true })
  filterReasons: string[] | null;

  @Column('uuid', { nullable: true })
  reviewedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewedByUserId' })
  reviewedBy: User | null;

  @Column({ type: 'text', nullable: true })
  reviewNote: string | null;

  // If approved, reference to the created segment
  @Column('uuid', { nullable: true })
  createdSegmentId: string | null;

  @ManyToOne(() => StorySegment, { nullable: true })
  @JoinColumn({ name: 'createdSegmentId' })
  createdSegment: StorySegment | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;
}
