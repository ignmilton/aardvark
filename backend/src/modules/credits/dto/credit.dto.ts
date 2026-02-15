import {
  IsUUID,
  IsOptional,
  IsInt,
  IsString,
  Min,
  Max,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * DTO for purchasing credits via bundle
 */
export class PurchaseCreditsDto {
  @IsUUID()
  bundleId: string;
}

/**
 * DTO for unlocking a premium story
 */
export class UnlockStoryDto {
  @IsUUID()
  storyId: string;
}

/**
 * DTO for tipping an author
 */
export class TipAuthorDto {
  @IsUUID()
  authorId: string;

  @IsOptional()
  @IsUUID()
  storyId?: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

/**
 * DTO for claiming daily bonus
 */
export class ClaimDailyBonusDto {
  // Empty - just needs authentication
}

/**
 * DTO for ad watch reward
 */
export class AdWatchRewardDto {
  @IsString()
  adType: string;

  @IsString()
  adUnitId: string;

  @IsInt()
  @Min(1)
  duration: number;

  completed: boolean;
}

/**
 * Query DTO for transaction history
 */
export class TransactionHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  type?: string;
}
