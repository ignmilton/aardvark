import {
  IsString,
  IsOptional,
  IsUrl,
  IsObject,
  MaxLength,
  ValidateNested,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Custom validator to ensure socialLinks values are valid URLs
 * and keys are from an allowed set of platform names.
 */
@ValidatorConstraint({ name: "socialLinksValidator", async: false })
class SocialLinksValidator implements ValidatorConstraintInterface {
  private readonly allowedPlatforms = [
    "twitter",
    "facebook",
    "instagram",
    "youtube",
    "tiktok",
    "linkedin",
    "github",
    "website",
    "mastodon",
    "bluesky",
    "threads",
    "twitch",
    "discord",
    "reddit",
    "patreon",
    "ko-fi",
  ];

  validate(value: Record<string, string>): boolean {
    if (!value || typeof value !== "object") return false;
    const entries = Object.entries(value);
    if (entries.length > 10) return false; // Max 10 social links
    const urlRegex = /^https?:\/\/.+/i;
    return entries.every(
      ([key, val]) =>
        this.allowedPlatforms.includes(key) &&
        typeof val === "string" &&
        val.length <= 500 &&
        urlRegex.test(val),
    );
  }

  defaultMessage(): string {
    return "socialLinks must contain valid platform names and HTTPS URLs (max 10 links)";
  }
}

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
  @Validate(SocialLinksValidator)
  socialLinks?: Record<string, string>;

  @ApiPropertyOptional({ description: "User preferences" })
  @IsOptional()
  @ValidateNested()
  @Type(() => PreferencesDto)
  preferences?: PreferencesDto;
}
