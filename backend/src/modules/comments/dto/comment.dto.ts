import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
  MaxLength,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateCommentDto {
  @ApiProperty({ description: "Story ID" })
  @IsUUID()
  storyId: string;

  @ApiPropertyOptional({
    description: "Segment ID (for segment-specific comments)",
  })
  @IsOptional()
  @IsUUID()
  segmentId?: string;

  @ApiPropertyOptional({ description: "Parent comment ID (for replies)" })
  @IsOptional()
  @IsUUID()
  parentCommentId?: string;

  @ApiProperty({
    description: "Comment content (markdown)",
    minLength: 1,
    maxLength: 5000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;
}

export class UpdateCommentDto {
  @ApiProperty({
    description: "Updated content (markdown)",
    minLength: 1,
    maxLength: 5000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;
}

export class CommentQueryDto {
  @ApiPropertyOptional({ description: "Story ID" })
  @IsOptional()
  @IsUUID()
  storyId?: string;

  @ApiPropertyOptional({ description: "Segment ID" })
  @IsOptional()
  @IsUUID()
  segmentId?: string;

  @ApiPropertyOptional({
    description: "Parent comment ID (for loading replies)",
  })
  @IsOptional()
  @IsUUID()
  parentCommentId?: string;

  @ApiPropertyOptional({ description: "Only root comments (no parent)" })
  @IsOptional()
  @Type(() => Boolean)
  rootOnly?: boolean;

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
    enum: ["recent", "oldest", "likes"],
  })
  @IsOptional()
  @IsString()
  sortBy?: "recent" | "oldest" | "likes" = "recent";
}
