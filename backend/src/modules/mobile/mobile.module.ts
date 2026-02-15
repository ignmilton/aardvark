import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import {
  PushSubscription,
  ReaderProgress,
  Story,
  User,
  Subscription,
  SubscriptionPlan,
} from "@/database/entities";
import { MobileController } from "./mobile.controller";
import { MobileService } from "./mobile.service";

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      PushSubscription,
      ReaderProgress,
      Story,
      User,
      Subscription,
      SubscriptionPlan,
    ]),
  ],
  controllers: [MobileController],
  providers: [MobileService],
  exports: [MobileService],
})
export class MobileModule {}
