import {
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
  IsArray,
  Min,
  Max,
  MaxLength,
  MinLength,
  ArrayMinSize,
  ArrayMaxSize,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * DTO for continuing a story
 */
export class ContinueStoryDto {
  @IsString()
  @MaxLength(10000)
  context: string;

  @IsString()
  @MaxLength(1000)
  prompt: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  style?: string;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(1000)
  length?: number = 300;
}

/**
 * DTO for suggesting story branches
 */
export class SuggestBranchesDto {
  @IsString()
  @MaxLength(5000)
  currentText: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(5)
  numBranches?: number = 3;
}

/**
 * DTO for improving writing
 */
export class ImproveWritingDto {
  @IsString()
  @MaxLength(5000)
  text: string;

  @IsOptional()
  @IsEnum(["grammar", "style", "both"])
  focus?: "grammar" | "style" | "both" = "both";
}

/**
 * DTO for generating character profiles
 */
export class GenerateCharacterDto {
  @IsString()
  @MaxLength(200)
  role: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  traits?: string[];

  @IsOptional()
  @IsString()
  genre?: string;
}

/**
 * DTO for generating dialogue options
 */
export class GenerateDialogueDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  characters: string[];

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  context: string;

  @IsOptional()
  @IsString()
  tone?: string;
}

/**
 * DTO for summarizing story content
 */
export class SummarizeStoryDto {
  @IsString()
  @MinLength(50)
  @MaxLength(20000)
  content: string;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(500)
  maxWords?: number = 200;
}

/**
 * DTO for generating plot ideas
 */
export class GeneratePlotIdeasDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  genre: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  themes?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  numIdeas?: number = 3;
}
