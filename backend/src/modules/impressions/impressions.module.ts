import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Impression, AuthorRevenue } from '@/database/entities/impression.entity';
import { Story, User } from '@/database/entities';
import { ImpressionsController } from './impressions.controller';
import { ImpressionsService } from './impressions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Impression, AuthorRevenue, Story, User]),
  ],
  controllers: [ImpressionsController],
  providers: [ImpressionsService],
  exports: [ImpressionsService],
})
export class ImpressionsModule {}
