import {
  IsString,
  IsOptional,
  IsUrl,
  IsObject,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

class PreferencesDto {
  @ApiPropertyOptional({ enum: ["light", "dark", "system"] })
  @IsOptional()
  @IsString()
  theme?: "light" | "dark" | "system";

  @ApiPropertyOptional({ enum: ["small", "medium", "large", "xlarge"] })
  @IsOptional()
  @IsString()
  fontSize?: "small" | "medium" | "large" | "xlarge";

  @ApiPropertyOptional({ enum: ["serif", "sans-serif", "monospace"] })
  @IsOptional()
  @IsString()
  fontFamily?: "serif" | "sans-serif" | "monospace";

  @ApiPropertyOptional({ enum: ["compact", "normal", "relaxed"] })
  @IsOptional()
  @IsString()
  lineSpacing?: "compact" | "normal" | "relaxed";

  @ApiPropertyOptional()
  @IsOptional()
  showNsfwContent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  emailNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  pushNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  notifyNewChapters?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  notifyCommentReplies?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  notifyFollowerActivity?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  showReadingHistory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  showFollowers?: boolean;

  @ApiPropertyOptional({ enum: ["everyone", "followers", "none"] })
  @IsOptional()
  @IsString()
  allowMessages?: "everyone" | "followers" | "none";

  @ApiPropertyOptional()
  @IsOptional()
  reduceMotion?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  highContrast?: boolean;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ description: "Display name", maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ description: "User bio", maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ description: "Website URL" })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @ApiPropertyOptional({ description: "Social media links" })
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;

  @ApiPropertyOptional({ description: "User preferences" })
  @IsOptional()
  @ValidateNested()
  @Type(() => PreferencesDto)
  preferences?: PreferencesDto;
}
