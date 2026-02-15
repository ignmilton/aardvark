import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Story, User, Tag, StoryTag, SearchHistory } from "@/database/entities";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Story, User, Tag, StoryTag, SearchHistory]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
