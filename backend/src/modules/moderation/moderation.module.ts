import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { ContentFilterService } from './content-filter.service';
import {
  Report,
  ModerationLog,
  UserWarning,
  UserBan,
  ContentFlag,
  User,
  BanAppeal,
  UserMute,
} from '@/database/entities';

/**
 * Moderation module providing content moderation, user reports,
 * warnings, bans, and admin tools for platform safety.
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
  ],
  controllers: [ModerationController],
  providers: [ModerationService, ContentFilterService],
  exports: [ModerationService, ContentFilterService],
})
export class ModerationModule {}
