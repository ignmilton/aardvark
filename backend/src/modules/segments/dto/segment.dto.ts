import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsArray,
  IsEnum,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class PositionDto {
  @ApiProperty()
  x: number;

  @ApiProperty()
  y: number;
}

export class CreateSegmentDto {
  @ApiProperty({ description: 'Story ID' })
  @IsUUID()
  storyId: string;

  @ApiPropertyOptional({ description: 'Parent segment ID (null for root segment)' })
  @IsOptional()
  @IsUUID()
  parentSegmentId?: string;

  @ApiPropertyOptional({ description: 'Segment title', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({ description: 'Segment content (HTML)' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Segment content (Markdown source)' })
  @IsOptional()
  @IsString()
  contentMarkdown?: string;

  @ApiPropertyOptional({ description: 'Position in visual editor' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PositionDto)
  position?: PositionDto;

  @ApiPropertyOptional({ description: 'Is this an ending segment' })
  @IsOptional()
  @IsBoolean()
  isEnding?: boolean;

  @ApiPropertyOptional({ enum: ['good', 'bad', 'neutral', 'secret'] })
  @IsOptional()
  @IsEnum(['good', 'bad', 'neutral', 'secret'])
  endingType?: 'good' | 'bad' | 'neutral' | 'secret';
}

export class UpdateSegmentDto {
  @ApiPropertyOptional({ description: 'Segment title', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Segment content (HTML)' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Segment content (Markdown source)' })
  @IsOptional()
  @IsString()
  contentMarkdown?: string;

  @ApiPropertyOptional({ description: 'Position in visual editor' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PositionDto)
  position?: PositionDto;

  @ApiPropertyOptional({ description: 'Is this an ending segment' })
  @IsOptional()
  @IsBoolean()
  isEnding?: boolean;

  @ApiPropertyOptional({ enum: ['good', 'bad', 'neutral', 'secret', null] })
  @IsOptional()
  endingType?: 'good' | 'bad' | 'neutral' | 'secret' | null;
}

export class SegmentQueryDto {
  @ApiPropertyOptional({ description: 'Story ID to filter by' })
  @IsOptional()
  @IsUUID()
  storyId?: string;

  @ApiPropertyOptional({ description: 'Author ID to filter by' })
  @IsOptional()
  @IsUUID()
  authorId?: string;

  @ApiPropertyOptional({ description: 'Include only root segments' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  rootOnly?: boolean;

  @ApiPropertyOptional({ description: 'Include only ending segments' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  endingsOnly?: boolean;

  @ApiPropertyOptional({ description: 'Approval status filter' })
  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected'])
  approvalStatus?: 'pending' | 'approved' | 'rejected';
}

export class BulkUpdatePositionsDto {
  @ApiProperty({ description: 'Array of segment positions' })
  @IsArray()
  positions: { segmentId: string; x: number; y: number }[];
}
