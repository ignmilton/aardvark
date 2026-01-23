import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Transaction,
  User,
  Story,
  CreditBundle,
  AuthorEarning,
  StoryUnlock,
} from '@/database/entities';
import { CreditsController } from './credits.controller';
import { CreditsService } from './credits.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      User,
      Story,
      CreditBundle,
      AuthorEarning,
      StoryUnlock,
    ]),
  ],
  controllers: [CreditsController],
  providers: [CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}
