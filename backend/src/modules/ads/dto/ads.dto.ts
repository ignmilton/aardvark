import { IsString, IsOptional, IsEnum, IsObject } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum AdType {
  REWARDED_VIDEO = "rewarded_video",
  INTERSTITIAL = "interstitial",
  REWARDED_INTERSTITIAL = "rewarded_interstitial",
}

export enum AdProvider {
  ADMOB = "admob",
  UNITY = "unity",
  APPLOVIN = "applovin",
  IRONSOURCE = "ironsource",
}

export class RecordAdRewardDto {
  @ApiProperty({ description: "Ad provider", enum: AdProvider })
  @IsEnum(AdProvider)
  adProvider: AdProvider;

  @ApiProperty({ description: "Ad type", enum: AdType })
  @IsEnum(AdType)
  adType: AdType;

  @ApiPropertyOptional({ description: "Ad unit ID" })
  @IsOptional()
  @IsString()
  adUnitId?: string;

  @ApiPropertyOptional({ description: "Session ID for tracking" })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: "Platform (ios, android, web)" })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ description: "Device ID for fraud prevention" })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ description: "Verification token from ad network" })
  @IsOptional()
  @IsString()
  verificationToken?: string;

  @ApiPropertyOptional({ description: "Additional metadata from ad network" })
  @IsOptional()
  @IsObject()
  adMetadata?: Record<string, any>;
}

export class AdConfigResponseDto {
  @ApiProperty({ description: "Whether ads are enabled" })
  enabled: boolean;

  @ApiProperty({ description: "Credits per rewarded video" })
  creditsPerRewardedVideo: number;

  @ApiProperty({ description: "Credits per interstitial" })
  creditsPerInterstitial: number;

  @ApiProperty({ description: "Daily ad limit" })
  dailyLimit: number;

  @ApiProperty({ description: "Cooldown between ads in seconds" })
  cooldownSeconds: number;

  @ApiProperty({ description: "Ad unit IDs by platform" })
  adUnits: {
    ios: {
      rewardedVideo: string;
      interstitial: string;
    };
    android: {
      rewardedVideo: string;
      interstitial: string;
    };
  };
}

export class DailyLimitResponseDto {
  @ApiProperty({ description: "Ads watched today" })
  watchedToday: number;

  @ApiProperty({ description: "Maximum ads per day" })
  dailyLimit: number;

  @ApiProperty({ description: "Remaining ads available" })
  remaining: number;

  @ApiProperty({ description: "Whether user can watch more ads" })
  canWatchMore: boolean;

  @ApiProperty({ description: "Credits earned today" })
  creditsEarnedToday: number;

  @ApiProperty({ description: "Next reset time (UTC)" })
  resetsAt: Date;
}

export class AdRewardResponseDto {
  @ApiProperty({ description: "Whether reward was granted" })
  success: boolean;

  @ApiProperty({ description: "Credits awarded" })
  creditsAwarded: number;

  @ApiProperty({ description: "New credit balance" })
  newBalance: number;

  @ApiProperty({ description: "Remaining ads for today" })
  remainingAdsToday: number;
}
