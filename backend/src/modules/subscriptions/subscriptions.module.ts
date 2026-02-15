import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import {
  Subscription,
  SubscriptionPlan,
  User,
  Transaction,
} from "@/database/entities";
import { PaymentsModule } from "@/modules/payments";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Subscription,
      SubscriptionPlan,
      User,
      Transaction,
    ]),
    PaymentsModule,
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
