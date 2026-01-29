import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { AdReward, User, Transaction } from '@/database/entities';

/**
 * Ads module for managing rewarded ads and credit rewards.
 * Handles ad configuration, reward tracking, and daily limits.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([AdReward, User, Transaction]),
  ],
  controllers: [AdsController],
  providers: [AdsService],
  exports: [AdsService],
})
export class AdsModule {}
