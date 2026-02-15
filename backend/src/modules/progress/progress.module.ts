import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  ReaderProgress,
  Story,
  StorySegment,
  Choice,
} from "@/database/entities";
import { ProgressController } from "./progress.controller";
import { ProgressService } from "./progress.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([ReaderProgress, Story, StorySegment, Choice]),
  ],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
