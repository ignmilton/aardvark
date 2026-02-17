import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsInt,
  Min,
  MaxLength,
  IsArray,
  ArrayMaxSize,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class CreateCollectionDto {
  @ApiProperty({ description: "Collection name", maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: "Collection description" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: "Cover image URL" })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({
    description: "Whether collection is public",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateCollectionDto {
  @ApiPropertyOptional({ description: "Collection name", maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: "Collection description" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: "Cover image URL" })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({ description: "Whether collection is public" })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class AddStoryToCollectionDto {
  @ApiProperty({ description: "Story ID to add" })
  @IsUUID()
  storyId: string;

  @ApiPropertyOptional({
    description: "Curator note about why this story is included",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  curatorNote?: string;
}

export class ReorderStoriesDto {
  @ApiProperty({ description: "Array of story IDs in desired order" })
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID("4", { each: true })
  storyIds: string[];
}

export class CollectionQueryDto {
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

  @ApiPropertyOptional({ description: "Search query" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: "Sort by field",
    enum: ["createdAt", "followerCount", "name"],
  })
  @IsOptional()
  @IsString()
  sortBy?: "createdAt" | "followerCount" | "name";

  @ApiPropertyOptional({ description: "Sort order", enum: ["asc", "desc"] })
  @IsOptional()
  @IsString()
  sortOrder?: "asc" | "desc";
}
