import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  ReadingList,
  ReadingListFollow,
  Story,
  User,
} from "@/database/entities";
import { ReadingListsService } from "./reading-lists.service";
import { ReadingListsController } from "./reading-lists.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([ReadingList, ReadingListFollow, Story, User]),
  ],
  controllers: [ReadingListsController],
  providers: [ReadingListsService],
  exports: [ReadingListsService],
})
export class ReadingListsModule {}
