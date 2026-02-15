import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Choice, StorySegment, Story } from "@/database/entities";
import { ChoicesController } from "./choices.controller";
import { ChoicesService } from "./choices.service";

@Module({
  imports: [TypeOrmModule.forFeature([Choice, StorySegment, Story])],
  controllers: [ChoicesController],
  providers: [ChoicesService],
  exports: [ChoicesService],
})
export class ChoicesModule {}
