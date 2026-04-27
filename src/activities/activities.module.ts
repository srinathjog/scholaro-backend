import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { Activity } from './activity.entity';
import { ActivityMedia } from './activity-media.entity';
import { Attendance } from '../attendance/attendance.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ParentsModule } from '../parents/parents.module';

@Module({
  imports: [TypeOrmModule.forFeature([Activity, ActivityMedia, Attendance, Enrollment]), NotificationsModule, ParentsModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
})
export class ActivitiesModule {}
