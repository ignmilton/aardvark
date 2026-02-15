import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsBoolean,
  IsOptional,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * DTO for user registration
 */
export class RegisterDto {
  @ApiProperty({
    example: "johndoe",
    description: "Unique username (3-30 alphanumeric characters)",
  })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: "Username can only contain letters, numbers, and underscores",
  })
  username: string;

  @ApiProperty({
    example: "john@example.com",
    description: "Valid email address",
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: "SecurePass123!",
    description:
      "Password (minimum 8 characters, must include uppercase, lowercase, and number)",
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
  })
  password: string;

  @ApiProperty({
    example: "John Doe",
    description: "Display name (optional)",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiProperty({
    example: true,
    description: "Accept terms and conditions",
  })
  @IsBoolean()
  acceptTerms: boolean;
}
