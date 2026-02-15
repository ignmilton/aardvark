import { IsUUID, IsOptional, IsString, IsBoolean } from "class-validator";

/**
 * DTO for creating a subscription
 */
export class CreateSubscriptionDto {
  @IsUUID()
  planId: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}

/**
 * DTO for canceling a subscription
 */
export class CancelSubscriptionDto {
  @IsOptional()
  @IsBoolean()
  cancelImmediately?: boolean;
}

/**
 * DTO for updating subscription payment method
 */
export class UpdatePaymentMethodDto {
  @IsString()
  paymentMethodId: string;
}
