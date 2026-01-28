import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { ReportReason } from './moderation.entity';

/**
 * Mute scope - what features are restricted
 */
export enum MuteScope {
  COMMENTS = 'comments',
  FORUM = 'forum',
  MESSAGING = 'messaging',
  ALL = 'all',
}

/**
 * UserMute entity - temporary restrictions on specific features.
 */
@Entity('user_mutes')
export class UserMute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  issuedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'issuedById' })
  issuedBy: User;

  @Column({
    type: 'enum',
    enum: MuteScope,
    default: MuteScope.ALL,
  })
  scope: MuteScope;

  @Column({
    type: 'enum',
    enum: ReportReason,
  })
  reason: ReportReason;

  @Column({ type: 'text' })
  details: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  liftedAt: Date | null;

  @Column('uuid', { nullable: true })
  liftedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'liftedById' })
  liftedBy: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
