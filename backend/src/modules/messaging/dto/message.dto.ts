import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  MinLength,
  IsDateString,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SendMessageDto {
  @ApiProperty({ description: "Recipient user ID" })
  @IsUUID()
  recipientId: string;

  @ApiProperty({
    description: "Message content",
    minLength: 1,
    maxLength: 5000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;
}

export class ConversationQueryDto {
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
    description: "Include archived conversations",
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  archived?: boolean = false;
}

export class MessageQueryDto {
  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Results per page", default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({ description: "Get messages before this date" })
  @IsOptional()
  @IsDateString()
  before?: string;
}

export class BlockUserDto {
  @ApiProperty({ description: "User ID to block" })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ description: "Reason for blocking" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
