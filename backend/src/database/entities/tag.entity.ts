import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinColumn,
} from 'typeorm';
import { TagType } from '@aardvark/shared';
import { Story } from './story.entity';
import { User } from './user.entity';

/**
 * Tag entity for story categorization and discovery.
 * Tags can be official (curated) or user-created.
 */
@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 50 })
  name: string;

  @Index({ unique: true })
  @Column({ length: 60 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: TagType,
    default: TagType.CUSTOM,
  })
  type: TagType;

  @Index()
  @Column({ default: 0 })
  usageCount: number;

  @Column({ default: false })
  isOfficial: boolean;

  @Index()
  @Column({ default: false })
  isFeatured: boolean;

  @Column('uuid', { nullable: true })
  parentTagId: string | null;

  @ManyToOne(() => Tag, (tag) => tag.childTags, { nullable: true })
  @JoinColumn({ name: 'parentTagId' })
  parentTag: Tag | null;

  @OneToMany(() => Tag, (tag) => tag.parentTag)
  childTags: Tag[];

  @Column('text', { array: true, default: [] })
  synonyms: string[];

  @Column({ length: 7, nullable: true })
  color: string | null;

  @Column({ nullable: true })
  iconUrl: string | null;

  // Creator (author who first used this tag)
  @Column('uuid', { nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @ManyToMany(() => Story, (story) => story.storyTags)
  stories: Story[];

  // Aliases for this tag (alternative names that resolve to this tag)
  @OneToMany(() => TagAlias, (alias) => alias.tag)
  aliases: TagAlias[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

/**
 * StoryTag join table entity for many-to-many relationship
 * with additional metadata about the tagging
 */
@Entity('story_tags')
@Index(['storyId', 'tagId'], { unique: true })
export class StoryTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  storyId: string;

  @Index()
  @Column('uuid')
  tagId: string;

  @ManyToOne(() => Story, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storyId' })
  story: Story;

  @ManyToOne(() => Tag, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tagId' })
  tag: Tag;

  @Column('uuid', { nullable: true })
  addedByUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  addedAt: Date;
}

/**
 * TagAlias entity for alternative tag names.
 * Allows users to search using synonyms that resolve to the canonical tag.
 */
@Entity('tag_aliases')
@Index(['alias'], { unique: true })
export class TagAlias {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ length: 50 })
  alias: string;

  @Index()
  @Column('uuid')
  tagId: string;

  @ManyToOne(() => Tag, (tag) => tag.aliases, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tagId' })
  tag: Tag;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
