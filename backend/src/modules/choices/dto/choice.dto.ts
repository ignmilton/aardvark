import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsArray,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChoiceDto {
  @ApiProperty({ description: 'Source segment ID' })
  @IsUUID()
  segmentId: string;

  @ApiProperty({ description: 'Destination segment ID' })
  @IsUUID()
  nextSegmentId: string;

  @ApiProperty({ description: 'Choice text displayed to reader', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  choiceText: string;

  @ApiPropertyOptional({ description: 'Display order (1-10)', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  order?: number;
}

export class UpdateChoiceDto {
  @ApiPropertyOptional({ description: 'Choice text', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  choiceText?: string;

  @ApiPropertyOptional({ description: 'Destination segment ID' })
  @IsOptional()
  @IsUUID()
  nextSegmentId?: string;

  @ApiPropertyOptional({ description: 'Display order (1-10)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  order?: number;

  @ApiPropertyOptional({ description: 'Hide this choice' })
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;
}

export class ReorderChoicesDto {
  @ApiProperty({ description: 'Array of choice IDs in new order' })
  @IsArray()
  @IsUUID('4', { each: true })
  choiceIds: string[];
}
