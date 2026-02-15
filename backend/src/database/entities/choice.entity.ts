import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from "typeorm";
import { StorySegment } from "./story-segment.entity";

/**
 * Choice entity representing a decision point that connects
 * one story segment to another.
 */
@Entity("choices")
export class Choice {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column("uuid")
  segmentId: string;

  @ManyToOne(() => StorySegment, (segment) => segment.choices, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "segmentId" })
  segment: StorySegment;

  @Index()
  @Column("uuid")
  nextSegmentId: string;

  @ManyToOne(() => StorySegment, (segment) => segment.incomingChoices, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "nextSegmentId" })
  nextSegment: StorySegment;

  @Column({ length: 500 })
  choiceText: string;

  @Column({ default: 1 })
  order: number;

  // Condition for showing this choice based on reader's state variables
  // e.g., { "has_sword": true, "trust_level": { "$gte": 5 } }
  @Column({ type: "jsonb", nullable: true })
  conditionJson: Record<string, unknown> | null;

  // State effects applied when this choice is made
  // e.g., { "$set": { "met_wizard": true }, "$inc": { "trust_level": 2 } }
  @Column({ type: "jsonb", nullable: true })
  stateEffects: Record<string, unknown> | null;

  // Statistics
  @Column({ default: 0 })
  timesChosen: number;

  @Column({ default: false })
  isHidden: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
