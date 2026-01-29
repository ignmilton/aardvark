import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Story,
  ReaderProgress,
  Rating,
  User,
} from '@/database/entities';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';
import { RecommendationService } from './recommendation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Story,
      ReaderProgress,
      Rating,
      User,
    ]),
  ],
  controllers: [StoriesController],
  providers: [StoriesService, RecommendationService],
  exports: [StoriesService, RecommendationService],
})
export class StoriesModule {}
