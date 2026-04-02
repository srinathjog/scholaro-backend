import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushSubscription } from './push-subscription.entity';
import { ParentStudent } from '../parents/parent-student.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PushSubscription, ParentStudent])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
