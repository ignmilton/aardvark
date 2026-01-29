import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeaturedContent } from '@/database/entities/featured-content.entity';
import { Story, Collection, User } from '@/database/entities';
import { FeaturedController } from './featured.controller';
import { FeaturedService } from './featured.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FeaturedContent, Story, Collection, User]),
  ],
  controllers: [FeaturedController],
  providers: [FeaturedService],
  exports: [FeaturedService],
})
export class FeaturedModule {}
