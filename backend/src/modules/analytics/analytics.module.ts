import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  Story,
  StorySegment,
  ReaderProgress,
  Comment,
  Rating,
  Transaction,
  Choice,
  User,
} from "@entities";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

/**
 * Analytics module providing comprehensive analytics and reporting features
 * for authors to track story performance, reader engagement, and earnings.
 *
 * Features:
 * - Author dashboard with key metrics and trends
 * - Detailed story analytics with branch heatmaps and engagement data
 * - Reader statistics and engagement tracking
 * - Earnings breakdown and revenue analytics
 * - Completion funnel analysis to identify drop-off points
 * - Export functionality for external analysis
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Story,
      StorySegment,
      ReaderProgress,
      Comment,
      Rating,
      Transaction,
      Choice,
      User,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
