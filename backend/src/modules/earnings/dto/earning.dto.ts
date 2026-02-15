import { IsOptional, IsString, IsInt, IsEnum, Min } from "class-validator";
import { Type } from "class-transformer";

/**
 * DTO for requesting a payout
 */
export class RequestPayoutDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5000) // Minimum $50
  amount?: number;
}

/**
 * DTO for setting up payout account
 */
export class SetupPayoutAccountDto {
  @IsString()
  country: string;

  @IsEnum(["individual", "company"])
  businessType: "individual" | "company";

  @IsString()
  returnUrl: string;

  @IsString()
  refreshUrl: string;
}

/**
 * Query DTO for earnings history
 */
export class EarningsQueryDto {
  @IsOptional()
  @IsEnum(["day", "week", "month", "year", "all_time"])
  period?: "day" | "week" | "month" | "year" | "all_time" = "month";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
