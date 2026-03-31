import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { DailyLogsService } from './daily-logs.service';
import { CreateDailyLogDto } from './dto/create-daily-log.dto';

@Controller('daily-logs')
export class DailyLogsController {
  constructor(private readonly dailyLogsService: DailyLogsService) {}

  // POST /daily-logs
  @Post()
  async create(@Body() dto: CreateDailyLogDto) {
    // tenant_id comes from body
    return this.dailyLogsService.create(dto);
  }

  // GET /daily-logs/student/:enrollmentId?tenant_id=...&date=YYYY-MM-DD
  @Get('student/:enrollmentId')
  async getStudentLogs(
    @Param('enrollmentId') enrollmentId: string,
    @Query('tenant_id') tenantId: string,
    @Query('date') date: string,
  ) {
    return this.dailyLogsService.findByStudentAndDate(
      tenantId,
      enrollmentId,
      date,
    );
  }

  // GET /daily-logs/class/:classId?tenant_id=...&date=YYYY-MM-DD
  @Get('class/:classId')
  async getClassSummary(
    @Param('classId') classId: string,
    @Query('tenant_id') tenantId: string,
    @Query('date') date: string,
  ) {
    return this.dailyLogsService.getClassSummary(tenantId, classId, date);
  }
}
