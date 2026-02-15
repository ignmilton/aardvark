import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StorySegment, Story, Choice } from "@/database/entities";
import { SegmentsController } from "./segments.controller";
import { SegmentsService } from "./segments.service";

@Module({
  imports: [TypeOrmModule.forFeature([StorySegment, Story, Choice])],
  controllers: [SegmentsController],
  providers: [SegmentsService],
  exports: [SegmentsService],
})
export class SegmentsModule {}
