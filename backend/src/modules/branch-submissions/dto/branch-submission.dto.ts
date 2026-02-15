import {
  IsString,
  IsUUID,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsEnum,
  IsInt,
  Min,
  Max,
  MaxLength,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * State effect DTO for segment data
 */
export class StateEffectDto {
  @IsString()
  variableId: string;

  @IsString()
  variableName: string;

  @IsString()
  @IsEnum(["set", "add", "subtract", "multiply", "append", "remove", "toggle"])
  operation:
    | "set"
    | "add"
    | "subtract"
    | "multiply"
    | "append"
    | "remove"
    | "toggle";

  @IsOptional()
  value: boolean | number | string;
}

/**
 * Choice condition DTO
 */
export class ChoiceConditionDto {
  @IsString()
  @IsEnum(["state", "visited", "not_visited", "custom"])
  type: "state" | "visited" | "not_visited" | "custom";

  @IsOptional()
  stateRequirement?: {
    variableId: string;
    variableName: string;
    operator: string;
    value: boolean | number | string;
  };

  @IsOptional()
  @IsUUID()
  segmentId?: string;

  @IsOptional()
  @IsString()
  customExpression?: string;
}

/**
 * Segment data for submission
 */
export class SegmentDataDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string | null;

  @IsString()
  @MinLength(10)
  content: string;

  @IsOptional()
  @IsString()
  contentMarkdown?: string | null;

  @IsOptional()
  @IsBoolean()
  isEnding?: boolean;

  @IsOptional()
  @IsEnum(["good", "bad", "neutral", "secret"])
  endingType?: "good" | "bad" | "neutral" | "secret" | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StateEffectDto)
  stateEffects?: StateEffectDto[];
}

/**
 * Choice data for submission
 */
export class ChoiceDataDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  choiceText: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  order?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChoiceConditionDto)
  conditions?: ChoiceConditionDto[];
}

/**
 * DTO for creating a branch submission
 */
export class CreateBranchSubmissionDto {
  @IsUUID()
  storyId: string;

  @IsUUID()
  parentSegmentId: string;

  @ValidateNested()
  @Type(() => SegmentDataDto)
  segmentData: SegmentDataDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChoiceDataDto)
  choicesData: ChoiceDataDto[];

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  submissionNote: string;
}

/**
 * DTO for reviewing a branch submission
 */
export class ReviewBranchSubmissionDto {
  @IsEnum(["approved", "rejected", "revision_requested"])
  status: "approved" | "rejected" | "revision_requested";

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}

/**
 * DTO for updating a branch submission (by submitter)
 */
export class UpdateBranchSubmissionDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => SegmentDataDto)
  segmentData?: SegmentDataDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChoiceDataDto)
  choicesData?: ChoiceDataDto[];

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  submissionNote?: string;
}

/**
 * Query parameters for listing submissions
 */
export class QueryBranchSubmissionsDto {
  @IsOptional()
  @IsUUID()
  storyId?: string;

  @IsOptional()
  @IsUUID()
  submittedByUserId?: string;

  @IsOptional()
  @IsEnum(["pending", "approved", "rejected", "revision_requested"])
  status?: "pending" | "approved" | "rejected" | "revision_requested";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
