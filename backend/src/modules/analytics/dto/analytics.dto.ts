import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * Time period for analytics queries
 */
export enum AnalyticsPeriod {
  DAY = "day",
  WEEK = "week",
  MONTH = "month",
  YEAR = "year",
  ALL = "all",
}

/**
 * Export format
 */
export enum ExportFormat {
  CSV = "csv",
  JSON = "json",
}

/**
 * DTO for analytics query with time period
 */
export class AnalyticsQueryDto {
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod = AnalyticsPeriod.MONTH;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/**
 * DTO for exporting analytics data
 */
export class ExportAnalyticsDto {
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @IsOptional()
  @IsBoolean()
  includeStories?: boolean = true;

  @IsOptional()
  @IsBoolean()
  includeEarnings?: boolean = true;

  @IsOptional()
  @IsBoolean()
  includeReaders?: boolean = true;

  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod = AnalyticsPeriod.MONTH;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/**
 * DTO for engagement trends query
 */
export class EngagementTrendsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number = 30;
}

/**
 * DTO for top stories query
 */
export class TopStoriesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod = AnalyticsPeriod.MONTH;
}

/**
 * DTO for recent activity query
 */
export class RecentActivityDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(["read", "comment", "rating", "earning", "all"])
  type?: "read" | "comment" | "rating" | "earning" | "all" = "all";
}
