import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TagType } from '@aardvark/shared';

export class CreateTagDto {
  @ApiProperty({ description: 'Tag name', example: 'Time Travel' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({ description: 'Tag description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ description: 'Tag type', enum: TagType })
  @IsEnum(TagType)
  type: TagType;

  @ApiPropertyOptional({ description: 'Parent tag ID for hierarchical tags' })
  @IsOptional()
  @IsString()
  parentTagId?: string;

  @ApiPropertyOptional({ description: 'Synonyms for this tag', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  synonyms?: string[];

  @ApiPropertyOptional({ description: 'Tag color (hex)', example: '#FF5733' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be a valid hex color' })
  color?: string;
}

export class UpdateTagDto {
  @ApiPropertyOptional({ description: 'Tag name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ description: 'Tag description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Tag type', enum: TagType })
  @IsOptional()
  @IsEnum(TagType)
  type?: TagType;

  @ApiPropertyOptional({ description: 'Parent tag ID' })
  @IsOptional()
  @IsString()
  parentTagId?: string;

  @ApiPropertyOptional({ description: 'Synonyms', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  synonyms?: string[];

  @ApiPropertyOptional({ description: 'Tag color (hex)' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be a valid hex color' })
  color?: string;

  @ApiPropertyOptional({ description: 'Mark as featured' })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: 'Mark as official' })
  @IsOptional()
  @IsBoolean()
  isOfficial?: boolean;
}

export class TagQueryDto {
  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by tag type', enum: TagType })
  @IsOptional()
  @IsEnum(TagType)
  type?: TagType;

  @ApiPropertyOptional({ description: 'Only featured tags' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ description: 'Only official tags' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  official?: boolean;

  @ApiPropertyOptional({ description: 'Minimum usage count' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minUsage?: number;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Results per page', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Sort by',
    enum: ['name', 'usage', 'trending', 'recent'],
  })
  @IsOptional()
  @IsString()
  sortBy?: 'name' | 'usage' | 'trending' | 'recent' = 'usage';
}

export class AddTagsToStoryDto {
  @ApiProperty({ description: 'Tag IDs to add', type: [String] })
  @IsArray()
  @IsString({ each: true })
  tagIds: string[];
}

export class RemoveTagFromStoryDto {
  @ApiProperty({ description: 'Tag ID to remove' })
  @IsString()
  tagId: string;
}

export class TagSuggestDto {
  @ApiProperty({ description: 'Search prefix for autocomplete' })
  @IsString()
  @MaxLength(50)
  prefix: string;

  @ApiPropertyOptional({ description: 'Tag type filter', enum: TagType })
  @IsOptional()
  @IsEnum(TagType)
  type?: TagType;

  @ApiPropertyOptional({ description: 'Maximum suggestions', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 10;
}

export class BulkTagActionDto {
  @ApiProperty({ description: 'Tag IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  tagIds: string[];

  @ApiProperty({ description: 'Action to perform', enum: ['feature', 'unfeature', 'merge', 'delete'] })
  @IsString()
  action: 'feature' | 'unfeature' | 'merge' | 'delete';

  @ApiPropertyOptional({ description: 'Target tag ID for merge action' })
  @IsOptional()
  @IsString()
  targetTagId?: string;
}

export class CreateTagAliasDto {
  @ApiProperty({ description: 'Alias text (alternative name for the tag)', example: 'sci-fi' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  alias: string;
}
