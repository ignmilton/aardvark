import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  ForumThread,
  ForumPost,
  ForumVote,
  UserReputation,
} from "@/database/entities";
import { ForumController } from "./forum.controller";
import { ForumService } from "./forum.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ForumThread,
      ForumPost,
      ForumVote,
      UserReputation,
    ]),
  ],
  controllers: [ForumController],
  providers: [ForumService],
  exports: [ForumService],
})
export class ForumModule {}
