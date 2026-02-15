import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ForgotPasswordDto {
  @ApiProperty({
    example: "user@example.com",
    description: "Email address to send reset link to",
  })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: "Password reset token from email",
  })
  @IsString()
  token: string;

  @ApiProperty({
    example: "NewSecurePass123!",
    description:
      "New password (minimum 8 characters, must include uppercase, lowercase, and number)",
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
  })
  newPassword: string;
}
