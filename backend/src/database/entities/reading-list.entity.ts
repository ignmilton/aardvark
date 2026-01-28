import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Story } from './story.entity';

/**
 * ReadingList entity - user-curated collections of stories.
 */
@Entity('reading_lists')
export class ReadingList {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: false })
  isPublic: boolean;

  @Column({ nullable: true })
  coverImageUrl: string | null;

  @Column({ default: 0 })
  storyCount: number;

  @Column({ default: 0 })
  followersCount: number;

  @ManyToMany(() => Story)
  @JoinTable({
    name: 'reading_list_stories',
    joinColumn: { name: 'readingListId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'storyId', referencedColumnName: 'id' },
  })
  stories: Story[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

/**
 * ReadingListFollow entity - users following reading lists.
 */
@Entity('reading_list_follows')
export class ReadingListFollow {
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
  readingListId: string;

  @ManyToOne(() => ReadingList, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'readingListId' })
  readingList: ReadingList;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
