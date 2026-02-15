import { IsEmail, IsString, IsOptional, IsBoolean } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * DTO for user login
 */
export class LoginDto {
  @ApiProperty({
    example: "john@example.com",
    description: "Email address",
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: "SecurePass123!",
    description: "Password",
  })
  @IsString()
  password: string;

  @ApiProperty({
    example: true,
    description: "Remember me for extended session",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
