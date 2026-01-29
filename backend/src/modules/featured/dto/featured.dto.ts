import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsInt,
  Min,
  MaxLength,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { FeaturedType, FeaturedPlacement } from '@/database/entities/featured-content.entity';

export class CreateFeaturedContentDto {
  @ApiProperty({ description: 'Type of featured content', enum: FeaturedType })
  @IsEnum(FeaturedType)
  type: FeaturedType;

  @ApiPropertyOptional({ description: 'Story ID (if featuring a story)' })
  @IsOptional()
  @IsUUID()
  storyId?: string;

  @ApiPropertyOptional({ description: 'Collection ID (if featuring a collection)' })
  @IsOptional()
  @IsUUID()
  collectionId?: string;

  @ApiPropertyOptional({ description: 'Author ID (if author spotlight)' })
  @IsOptional()
  @IsUUID()
  authorId?: string;

  @ApiProperty({ description: 'Display title', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Banner image URL' })
  @IsOptional()
  @IsString()
  bannerImageUrl?: string;

  @ApiProperty({ description: 'Start date (ISO 8601)' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601, null for indefinite)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Whether featured content is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Priority (higher = more prominent)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ description: 'Placement location', enum: FeaturedPlacement })
  @IsOptional()
  @IsEnum(FeaturedPlacement)
  placement?: FeaturedPlacement;
}

export class UpdateFeaturedContentDto {
  @ApiPropertyOptional({ description: 'Type of featured content', enum: FeaturedType })
  @IsOptional()
  @IsEnum(FeaturedType)
  type?: FeaturedType;

  @ApiPropertyOptional({ description: 'Story ID' })
  @IsOptional()
  @IsUUID()
  storyId?: string;

  @ApiPropertyOptional({ description: 'Collection ID' })
  @IsOptional()
  @IsUUID()
  collectionId?: string;

  @ApiPropertyOptional({ description: 'Author ID' })
  @IsOptional()
  @IsUUID()
  authorId?: string;

  @ApiPropertyOptional({ description: 'Display title', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Banner image URL' })
  @IsOptional()
  @IsString()
  bannerImageUrl?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Whether featured content is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Priority' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ description: 'Placement location', enum: FeaturedPlacement })
  @IsOptional()
  @IsEnum(FeaturedPlacement)
  placement?: FeaturedPlacement;
}

export class FeaturedQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by type', enum: FeaturedType })
  @IsOptional()
  @IsEnum(FeaturedType)
  type?: FeaturedType;

  @ApiPropertyOptional({ description: 'Filter by placement', enum: FeaturedPlacement })
  @IsOptional()
  @IsEnum(FeaturedPlacement)
  placement?: FeaturedPlacement;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
