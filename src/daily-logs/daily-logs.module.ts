import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyLogsController } from './daily-logs.controller';
import { DailyLogsService } from './daily-logs.service';
import { DailyLog } from './daily-log.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ParentsModule } from '../parents/parents.module';

@Module({
  imports: [TypeOrmModule.forFeature([DailyLog, Enrollment]), NotificationsModule, ParentsModule],
  controllers: [DailyLogsController],
  providers: [DailyLogsService],
})
export class DailyLogsModule {}
