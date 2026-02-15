import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  IsEnum,
  IsDateString,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ImpressionType } from "@/database/entities/impression.entity";

export class RecordImpressionDto {
  @ApiProperty({ description: "Story ID" })
  @IsUUID()
  storyId: string;

  @ApiProperty({ description: "Impression type", enum: ImpressionType })
  @IsEnum(ImpressionType)
  type: ImpressionType;

  @ApiPropertyOptional({ description: "Segment ID (for segment reads)" })
  @IsOptional()
  @IsUUID()
  segmentId?: string;

  @ApiPropertyOptional({
    description: "Duration in seconds (for read impressions)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @ApiPropertyOptional({ description: "Session ID (for anonymous users)" })
  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class ImpressionQueryDto {
  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Items per page", default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({ description: "Filter by story ID" })
  @IsOptional()
  @IsUUID()
  storyId?: string;

  @ApiPropertyOptional({
    description: "Filter by impression type",
    enum: ImpressionType,
  })
  @IsOptional()
  @IsEnum(ImpressionType)
  type?: ImpressionType;

  @ApiPropertyOptional({ description: "Start date (ISO 8601)" })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: "End date (ISO 8601)" })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class RevenueQueryDto {
  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Items per page", default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: "Filter by story ID" })
  @IsOptional()
  @IsUUID()
  storyId?: string;

  @ApiPropertyOptional({ description: "Start date (ISO 8601)" })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: "End date (ISO 8601)" })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class CalculateRevenueDto {
  @ApiProperty({ description: "Period start date (ISO 8601)" })
  @IsDateString()
  periodStart: string;

  @ApiProperty({ description: "Period end date (ISO 8601)" })
  @IsDateString()
  periodEnd: string;

  @ApiPropertyOptional({ description: "Total revenue pool amount" })
  @IsOptional()
  @Type(() => Number)
  totalRevenuePool?: number;
}
