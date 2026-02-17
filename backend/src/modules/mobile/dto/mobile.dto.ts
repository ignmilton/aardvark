import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsArray,
  ValidateNested,
  IsDateString,
  ArrayMaxSize,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export enum Platform {
  IOS = "ios",
  ANDROID = "android",
}

export class RegisterPushTokenDto {
  @ApiProperty({ description: "Push notification token" })
  @IsString()
  token: string;

  @ApiProperty({ description: "Platform", enum: Platform })
  @IsEnum(Platform)
  platform: Platform;

  @ApiPropertyOptional({ description: "Device identifier" })
  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class SyncRequestDto {
  @ApiPropertyOptional({ description: "Last sync timestamp (ISO 8601)" })
  @IsOptional()
  @IsDateString()
  lastSyncAt?: string;

  @ApiPropertyOptional({ description: "Story IDs to sync progress for" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID("4", { each: true })
  storyIds?: string[];
}

export class OfflineProgressDto {
  @ApiProperty({ description: "Story ID" })
  @IsUUID()
  storyId: string;

  @ApiProperty({ description: "Current segment ID" })
  @IsUUID()
  currentSegmentId: string;

  @ApiProperty({ description: "Visited segment IDs" })
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID("4", { each: true })
  visitedSegmentIds: string[];

  @ApiPropertyOptional({ description: "Choice history" })
  @IsOptional()
  @IsArray()
  choiceHistory?: Array<{
    segmentId: string;
    choiceId: string;
    timestamp: string;
  }>;

  @ApiProperty({ description: "Last read timestamp (ISO 8601)" })
  @IsDateString()
  lastReadAt: string;
}

export class SyncProgressDto {
  @ApiProperty({
    description: "Offline progress to sync",
    type: [OfflineProgressDto],
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OfflineProgressDto)
  progress: OfflineProgressDto[];
}

export class VerifyIosReceiptDto {
  @ApiProperty({ description: "iOS App Store receipt data (base64)" })
  @IsString()
  receiptData: string;

  @ApiPropertyOptional({ description: "Whether this is a sandbox receipt" })
  @IsOptional()
  sandbox?: boolean;
}

export class VerifyAndroidReceiptDto {
  @ApiProperty({ description: "Google Play purchase token" })
  @IsString()
  purchaseToken: string;

  @ApiProperty({ description: "Product ID (subscription ID)" })
  @IsString()
  productId: string;

  @ApiProperty({ description: "Package name" })
  @IsString()
  packageName: string;
}
