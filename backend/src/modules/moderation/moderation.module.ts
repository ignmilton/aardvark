import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { ModerationController } from "./moderation.controller";
import { ModerationService } from "./moderation.service";
import { ContentFilterService } from "./content-filter.service";
import {
  Report,
  ModerationLog,
  UserWarning,
  UserBan,
  ContentFlag,
  User,
  BanAppeal,
  UserMute,
} from "@/database/entities";
import { StoriesModule } from "@/modules/stories/stories.module";

/**
 * Moderation module providing content moderation, user reports,
 * warnings, bans, and admin tools for platform safety.
 * Also handles story pre-publication review workflow.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Report,
      ModerationLog,
      UserWarning,
      UserBan,
      ContentFlag,
      User,
      BanAppeal,
      UserMute,
    ]),
    forwardRef(() => StoriesModule),
  ],
  controllers: [ModerationController],
  providers: [ModerationService, ContentFilterService],
  exports: [ModerationService, ContentFilterService],
})
export class ModerationModule {}
