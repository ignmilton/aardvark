import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  AuthorEarning,
  AuthorPayoutAccount,
  Payout,
  User,
} from "@/database/entities";
import { PaymentsModule } from "@/modules/payments";
import { EarningsController } from "./earnings.controller";
import { EarningsService } from "./earnings.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuthorEarning,
      AuthorPayoutAccount,
      Payout,
      User,
    ]),
    PaymentsModule,
  ],
  controllers: [EarningsController],
  providers: [EarningsService],
  exports: [EarningsService],
})
export class EarningsModule {}
