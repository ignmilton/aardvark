import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { TransactionType } from '@aardvark/shared';
import { User } from './user.entity';

/**
 * Transaction entity for credit system tracking.
 */
@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, (user) => user.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column()
  amount: number;

  @Column()
  balance: number;

  @Column({ type: 'text' })
  description: string;

  @Column('uuid', { nullable: true })
  referenceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  referenceType: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
