import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "@aardvark/shared";

export class UserQueryDto {
  @ApiPropertyOptional({ description: "Search by username or display name" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: "Filter by role", enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Items per page", default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: "Sort by field",
    enum: ["createdAt", "username", "followersCount"],
  })
  @IsOptional()
  @IsString()
  sortBy?: "createdAt" | "username" | "followersCount" = "createdAt";

  @ApiPropertyOptional({ description: "Sort order", enum: ["asc", "desc"] })
  @IsOptional()
  @IsString()
  sortOrder?: "asc" | "desc" = "desc";
}
