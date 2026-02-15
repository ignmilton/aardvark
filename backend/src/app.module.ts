import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { APP_GUARD } from "@nestjs/core";

// Feature modules
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { StoriesModule } from "./modules/stories/stories.module";
import { SegmentsModule } from "./modules/segments/segments.module";
import { ChoicesModule } from "./modules/choices/choices.module";
import { ProgressModule } from "./modules/progress/progress.module";
import { CommentsModule } from "./modules/comments/comments.module";
import { RatingsModule } from "./modules/ratings/ratings.module";
import { CreditsModule } from "./modules/credits/credits.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { SearchModule } from "./modules/search/search.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ModerationModule } from "./modules/moderation/moderation.module";
import { UploadModule } from "./modules/upload/upload.module";
import { AiModule } from "./modules/ai/ai.module";
import { AICompanionModule } from "./modules/ai-companion/ai-companion.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { MessagingModule } from "./modules/messaging/messaging.module";
import { ForumModule } from "./modules/forum/forum.module";
import { WebsocketModule } from "./modules/websocket/websocket.module";
import { HealthModule } from "./modules/health/health.module";
import { TagsModule } from "./modules/tags/tags.module";
import { ReadingListsModule } from "./modules/reading-lists/reading-lists.module";
import { CollectionsModule } from "./modules/collections/collections.module";
import { FeaturedModule } from "./modules/featured/featured.module";
import { ImpressionsModule } from "./modules/impressions/impressions.module";
import { MobileModule } from "./modules/mobile/mobile.module";
import { AdsModule } from "./modules/ads/ads.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { EarningsModule } from "./modules/earnings/earnings.module";
import { BranchSubmissionsModule } from "./modules/branch-submissions/branch-submissions.module";

// Common modules
import { CacheModule } from "./common/cache/cache.module";
import { MailModule } from "./common/mail/mail.module";

// Configuration
import configuration from "./config/configuration";
import { databaseConfig } from "./config/database.config";

/**
 * Root application module that imports all feature modules
 * and configures global providers.
 */
@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [".env.local", ".env"],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: databaseConfig,
      inject: [ConfigService],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get("RATE_LIMIT_TTL", 60000),
            limit: config.get("RATE_LIMIT_MAX", 100),
          },
        ],
      }),
    }),

    // Scheduled tasks
    ScheduleModule.forRoot(),

    // Common modules
    CacheModule,
    MailModule,

    // Feature modules
    AuthModule,
    UsersModule,
    StoriesModule,
    SegmentsModule,
    ChoicesModule,
    ProgressModule,
    CommentsModule,
    RatingsModule,
    CreditsModule,
    SubscriptionsModule,
    SearchModule,
    NotificationsModule,
    ModerationModule,
    UploadModule,
    AiModule,
    AICompanionModule,
    AnalyticsModule,
    MessagingModule,
    ForumModule,
    WebsocketModule,
    HealthModule,
    TagsModule,
    ReadingListsModule,
    CollectionsModule,
    FeaturedModule,
    ImpressionsModule,
    MobileModule,
    AdsModule,
    PaymentsModule,
    EarningsModule,
    BranchSubmissionsModule,
  ],
  providers: [
    // Global rate limit guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
