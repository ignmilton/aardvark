import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushSubscription, ReaderProgress, Story, User, Subscription } from '@/database/entities';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PushSubscription, ReaderProgress, Story, User, Subscription]),
  ],
  controllers: [MobileController],
  providers: [MobileService],
  exports: [MobileService],
})
export class MobileModule {}
