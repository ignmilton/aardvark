import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  Rating,
  Story,
  ReaderProgress,
  Transaction,
  User,
} from "@/database/entities";
import { RatingsController } from "./ratings.controller";
import { RatingsService } from "./ratings.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Rating,
      Story,
      ReaderProgress,
      Transaction,
      User,
    ]),
  ],
  controllers: [RatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
