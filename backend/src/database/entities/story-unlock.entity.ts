import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Story } from './story.entity';

/**
 * Tracks which premium stories each user has unlocked.
 * Prevents duplicate purchases and enables content access checks.
 */
@Entity('story_unlocks')
@Unique(['userId', 'storyId'])
export class StoryUnlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column('uuid')
  storyId: string;

  @ManyToOne(() => Story, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storyId' })
  story: Story;

  @Column('uuid')
  transactionId: string;

  @Column()
  creditCost: number;

  @CreateDateColumn({ type: 'timestamptz' })
  unlockedAt: Date;
}
