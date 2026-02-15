import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class StartReadingDto {
  @ApiProperty({ description: "Story ID" })
  @IsUUID()
  storyId: string;
}

export class MakeChoiceDto {
  @ApiProperty({ description: "Choice ID selected by reader" })
  @IsUUID()
  choiceId: string;

  @ApiPropertyOptional({
    description: "Time spent on current segment (seconds)",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  timeSpent?: number;
}

export class NavigateToSegmentDto {
  @ApiProperty({ description: "Segment ID to navigate to" })
  @IsUUID()
  segmentId: string;
}

export class AddBookmarkDto {
  @ApiProperty({ description: "Segment ID to bookmark" })
  @IsUUID()
  segmentId: string;

  @ApiPropertyOptional({ description: "Note for the bookmark", maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateBookmarkDto {
  @ApiPropertyOptional({ description: "Updated note", maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ProgressQueryDto {
  @ApiPropertyOptional({ description: "Filter by story ID" })
  @IsOptional()
  @IsUUID()
  storyId?: string;

  @ApiPropertyOptional({ description: "Only show completed" })
  @IsOptional()
  isCompleted?: boolean;
}
