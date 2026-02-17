import {
  IsString,
  IsUUID,
  IsOptional,
  IsUrl,
  IsEnum,
  IsBoolean,
  IsNumber,
  Min,
  MaxLength,
  Matches,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * DTO for creating a checkout session for credit purchase
 */
export class CreateCreditCheckoutDto {
  @IsUUID()
  bundleId: string;

  @IsUrl()
  successUrl: string;

  @IsUrl()
  cancelUrl: string;
}

/**
 * DTO for creating a checkout session for subscription
 */
export class CreateSubscriptionCheckoutDto {
  @IsUUID()
  planId: string;

  @IsUrl()
  successUrl: string;

  @IsUrl()
  cancelUrl: string;
}

/**
 * DTO for creating a setup intent
 */
export class CreateSetupIntentDto {
  @IsOptional()
  @IsString()
  returnUrl?: string;
}

/**
 * DTO for creating a Connect account for author payouts
 */
export class CreateConnectAccountDto {
  @IsString()
  country: string;

  @IsEnum(["individual", "company"])
  businessType: "individual" | "company";

  @IsUrl()
  returnUrl: string;

  @IsUrl()
  refreshUrl: string;
}

/**
 * DTO for canceling a subscription
 */
export class CancelSubscriptionDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  cancelImmediately?: boolean;
}

// ============================================================================
// UPI Payment DTOs
// ============================================================================

/**
 * DTO for creating a UPI payment order
 */
export class CreateUPIOrderDto {
  @IsUUID()
  bundleId: string;
}

/**
 * DTO for verifying UPI payment
 */
export class VerifyUPIPaymentDto {
  @IsString()
  razorpayOrderId: string;

  @IsString()
  razorpayPaymentId: string;

  @IsString()
  razorpaySignature: string;
}

/**
 * DTO for setting up author's UPI payout account
 */
export class SetupUPIPayoutAccountDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/, {
    message: "Invalid UPI VPA format (e.g., username@upi)",
  })
  @MaxLength(100)
  upiVpa: string;

  @IsString()
  @MaxLength(200)
  accountHolderName: string;
}

/**
 * DTO for requesting a UPI payout
 */
export class RequestUPIPayoutDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount?: number; // In paise, defaults to full available balance
}
