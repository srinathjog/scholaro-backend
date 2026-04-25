import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { EventsCalendar } from './event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventsCalendar]),
    MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } }), // 5 MB
  ],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
