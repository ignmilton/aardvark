import {
  IsString,
  IsNotEmpty,
  IsObject,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

class PushSubscriptionKeys {
  @ApiProperty({ description: "P256DH key" })
  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @ApiProperty({ description: "Auth key" })
  @IsString()
  @IsNotEmpty()
  auth: string;
}

export class PushSubscribeDto {
  @ApiProperty({ description: "Push subscription endpoint URL" })
  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @ApiProperty({ description: "Subscription keys", type: PushSubscriptionKeys })
  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeys)
  keys: PushSubscriptionKeys;
}

export class PushUnsubscribeDto {
  @ApiProperty({ description: "Push subscription endpoint URL to remove" })
  @IsString()
  @IsNotEmpty()
  endpoint: string;
}
