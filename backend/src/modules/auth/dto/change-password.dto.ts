import { IsString, MinLength, MaxLength, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * DTO for changing password
 */
export class ChangePasswordDto {
  @ApiProperty({
    description: "Current password",
  })
  @IsString()
  currentPassword: string;

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
