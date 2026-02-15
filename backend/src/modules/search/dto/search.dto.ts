import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  StoryCategory,
  StoryLength,
  StoryComplexity,
  ContentWarning,
} from "@aardvark/shared";

export class SearchStoriesDto {
  @ApiProperty({ description: "Search query" })
  @IsString()
  @MaxLength(200)
  query: string;

  @ApiPropertyOptional({ description: "Filter by categories", type: [String] })
  @IsOptional()
  @IsArray()
  @IsEnum(StoryCategory, { each: true })
  categories?: StoryCategory[];

  @ApiPropertyOptional({ description: "Filter by tags", type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: "Exclude content warnings",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ContentWarning, { each: true })
  excludeWarnings?: ContentWarning[];

  @ApiPropertyOptional({
    description: "Filter by story length",
    enum: StoryLength,
  })
  @IsOptional()
  @IsEnum(StoryLength)
  length?: StoryLength;

  @ApiPropertyOptional({
    description: "Filter by complexity",
    enum: StoryComplexity,
  })
  @IsOptional()
  @IsEnum(StoryComplexity)
  complexity?: StoryComplexity;

  @ApiPropertyOptional({ description: "Minimum rating (0-5)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ description: "Only show free stories" })
  @IsOptional()
  @Type(() => Boolean)
  freeOnly?: boolean;

  @ApiPropertyOptional({ description: "Filter by author ID" })
  @IsOptional()
  @IsString()
  authorId?: string;

  @ApiPropertyOptional({ description: "Language code (ISO 639-1)" })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Results per page", default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: "Sort by",
    enum: ["relevance", "rating", "views", "recent", "trending"],
  })
  @IsOptional()
  @IsString()
  sortBy?: "relevance" | "rating" | "views" | "recent" | "trending" =
    "relevance";
}

export class SearchUsersDto {
  @ApiProperty({ description: "Search query" })
  @IsString()
  @MaxLength(100)
  query: string;

  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Results per page", default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class AutocompleteDto {
  @ApiProperty({ description: "Search prefix" })
  @IsString()
  @MaxLength(50)
  prefix: string;

  @ApiPropertyOptional({
    description: "Type of autocomplete",
    enum: ["story", "user", "tag"],
  })
  @IsOptional()
  @IsString()
  type?: "story" | "user" | "tag" = "story";

  @ApiPropertyOptional({ description: "Maximum suggestions", default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 10;
}

export class SearchTagsDto {
  @ApiProperty({ description: "Search query" })
  @IsString()
  @MaxLength(100)
  query: string;

  @ApiPropertyOptional({ description: "Filter by tag type" })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Results per page", default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class AdvancedSearchDto {
  @ApiPropertyOptional({ description: "Text search query" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  query?: string;

  @ApiPropertyOptional({ description: "Tag IDs to filter by", type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];

  @ApiPropertyOptional({
    description: "Tag names to filter by",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagNames?: string[];

  @ApiPropertyOptional({
    description: "Require all tags (AND) vs any tag (OR)",
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  matchAllTags?: boolean = false;

  @ApiPropertyOptional({ description: "Filter by categories", type: [String] })
  @IsOptional()
  @IsArray()
  @IsEnum(StoryCategory, { each: true })
  categories?: StoryCategory[];

  @ApiPropertyOptional({ description: "Minimum rating (0-5)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Results per page", default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
