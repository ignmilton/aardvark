import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  BranchSubmission,
  Story,
  StorySegment,
  Choice,
} from "@/database/entities";
import { BranchSubmissionsController } from "./branch-submissions.controller";
import { BranchSubmissionsService } from "./branch-submissions.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([BranchSubmission, Story, StorySegment, Choice]),
  ],
  controllers: [BranchSubmissionsController],
  providers: [BranchSubmissionsService],
  exports: [BranchSubmissionsService],
})
export class BranchSubmissionsModule {}
