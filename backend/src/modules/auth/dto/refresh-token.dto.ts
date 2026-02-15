import { IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * DTO for token refresh
 */
export class RefreshTokenDto {
  @ApiProperty({
    description: "Refresh token",
  })
  @IsString()
  refreshToken: string;
}
