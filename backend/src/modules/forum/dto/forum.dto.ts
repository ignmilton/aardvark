import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  MinLength,
  IsIn,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ForumCategory } from "@/database/entities/forum.entity";

export class CreateThreadDto {
  @ApiProperty({ description: "Thread category", enum: ForumCategory })
  @IsEnum(ForumCategory)
  category: ForumCategory;

  @ApiProperty({ description: "Thread title", minLength: 5, maxLength: 200 })
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: "Thread content (markdown)",
    minLength: 10,
    maxLength: 10000,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  content: string;
}

export class UpdateThreadDto {
  @ApiPropertyOptional({
    description: "Thread title",
    minLength: 5,
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description: "Thread content (markdown)",
    minLength: 10,
    maxLength: 10000,
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  content?: string;

  @ApiPropertyOptional({ description: "Thread category", enum: ForumCategory })
  @IsOptional()
  @IsEnum(ForumCategory)
  category?: ForumCategory;
}

export class CreatePostDto {
  @ApiProperty({
    description: "Post content (markdown)",
    minLength: 1,
    maxLength: 10000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content: string;

  @ApiPropertyOptional({ description: "Reply to post ID" })
  @IsOptional()
  @IsUUID()
  replyToId?: string;
}

export class UpdatePostDto {
  @ApiProperty({
    description: "Updated post content (markdown)",
    minLength: 1,
    maxLength: 10000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content: string;
}

export class VotePostDto {
  @ApiProperty({
    description: "Vote value: 1 for upvote, -1 for downvote",
    enum: [1, -1],
  })
  @IsInt()
  @IsIn([1, -1])
  value: 1 | -1;
}

export class ThreadQueryDto {
  @ApiPropertyOptional({
    description: "Filter by category",
    enum: ForumCategory,
  })
  @IsOptional()
  @IsEnum(ForumCategory)
  category?: ForumCategory;

  @ApiPropertyOptional({ description: "Filter by author user ID" })
  @IsOptional()
  @IsUUID()
  authorId?: string;

  @ApiPropertyOptional({ description: "Search query for title/content" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: "Show only pinned threads" })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  pinnedOnly?: boolean;

  @ApiPropertyOptional({
    description: "Sort by",
    enum: ["recent", "oldest", "replies", "views"],
  })
  @IsOptional()
  @IsString()
  sortBy?: "recent" | "oldest" | "replies" | "views";

  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: "Results per page", default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class PostQueryDto {
  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: "Results per page", default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: "Sort by",
    enum: ["oldest", "newest", "votes"],
  })
  @IsOptional()
  @IsString()
  sortBy?: "oldest" | "newest" | "votes";
}

export class PinThreadDto {
  @ApiProperty({ description: "Pin status" })
  @IsBoolean()
  isPinned: boolean;
}
