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

/**
 * Push subscription entity for Web Push and Mobile Push notifications.
 */
@Entity('push_subscriptions')
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Web Push endpoint (for web browsers)
  @Index({ unique: true })
  @Column({ type: 'text', nullable: true })
  endpoint: string;

  // Web Push keys
  @Column({ type: 'text', nullable: true })
  p256dh: string;

  @Column({ type: 'text', nullable: true })
  auth: string;

  // Mobile push token (FCM/APNs)
  @Index()
  @Column({ type: 'text', nullable: true })
  token: string;

  // Platform type: 'web', 'ios', 'android'
  @Column({ length: 20, default: 'web' })
  platform: string;

  // Device identifier for mobile
  @Column({ type: 'varchar', nullable: true })
  deviceId: string;

  // Whether the subscription is active
  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'varchar', nullable: true })
  userAgent: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
