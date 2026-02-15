import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { User, Transaction } from "@/database/entities";
import { AICompanionController } from "./ai-companion.controller";
import { AICompanionService } from "./ai-companion.service";

/**
 * AI Companion Module
 * Provides AI-powered writing assistance using OpenAI GPT models
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, Transaction]), ConfigModule],
  controllers: [AICompanionController],
  providers: [AICompanionService],
  exports: [AICompanionService],
})
export class AICompanionModule {}
