import { Module, forwardRef } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { RazorpayService } from "./razorpay.service";
import { CreditsModule } from "@/modules/credits/credits.module";
import {
  UPIPaymentOrder,
  AuthorPayoutAccount,
  Payout,
  CreditBundle,
  Subscription,
  SubscriptionPlan,
  User,
} from "@/database/entities";

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      UPIPaymentOrder,
      AuthorPayoutAccount,
      Payout,
      CreditBundle,
      Subscription,
      SubscriptionPlan,
      User,
    ]),
    forwardRef(() => CreditsModule),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, RazorpayService],
  exports: [PaymentsService, RazorpayService],
})
export class PaymentsModule {}
