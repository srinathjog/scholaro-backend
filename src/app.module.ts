import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StudentsModule } from './students/students.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { AcademicYearsModule } from './academic-years/academic-years.module';
import { ClassesModule } from './classes/classes.module';
import { SectionsModule } from './sections/sections.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AttendanceModule } from './attendance/attendance.module';
import { TeacherAssignmentsModule } from './teacher-assignments/teacher-assignments.module';
import { ParentsModule } from './parents/parents.module';
import { ActivitiesModule } from './activities/activities.module';
import { DailyLogsModule } from './daily-logs/daily-logs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MessagesModule } from './messages/messages.module';
import { BulkImportModule } from './bulk-import/bulk-import.module';
import { FeesModule } from './fees/fees.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { SettingsModule } from './settings/settings.module';
import { MailModule } from './mail/mail.module';
import { StorageModule } from './storage/storage.module';
import { CalendarModule } from './calendar/calendar.module';
import { LeadsModule } from './leads/leads.module';
import { SchoolDocumentsModule } from './school-documents/school-documents.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        if (databaseUrl) {
          return {
            type: 'postgres',
            url: databaseUrl,
            autoLoadEntities: true,
            synchronize: false,
            extra: {
              max: 4,
              idleTimeoutMillis: 10000,
              connectionTimeoutMillis: 5000,
              keepAlive: false,
            },
            retryAttempts: 5,
            retryDelay: 3000,
          };
        }
        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST'),
          port: parseInt(configService.get<string>('DB_PORT') || '5432', 10),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_NAME'),
          autoLoadEntities: true,
          synchronize: true,
        };
      },
    }),
    StudentsModule,
    EnrollmentsModule,
    AcademicYearsModule,
    ClassesModule,
    SectionsModule,
    AuthModule,
    UsersModule,
    AttendanceModule,
    TeacherAssignmentsModule,
    ParentsModule,
    ActivitiesModule,
    DailyLogsModule,
    NotificationsModule,
    MessagesModule,
    BulkImportModule,
    FeesModule,
    AnalyticsModule,
    SuperAdminModule,
    SettingsModule,
    MailModule,
    StorageModule,
    CalendarModule,
    LeadsModule,
    SchoolDocumentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
