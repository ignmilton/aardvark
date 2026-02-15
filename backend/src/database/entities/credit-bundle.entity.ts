import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

/**
 * Credit bundle entity - purchasable credit packages
 */
@Entity("credit_bundles")
export class CreditBundle {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column()
  credits: number;

  @Column()
  priceInCents: number;

  @Column({ default: "usd" })
  currency: string;

  @Column()
  stripePriceId: string;

  @Column({ default: 0 })
  bonusCredits: number;

  @Column({ default: false })
  isPopular: boolean;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  /**
   * Get total credits including bonus
   */
  get totalCredits(): number {
    return this.credits + this.bonusCredits;
  }
}
