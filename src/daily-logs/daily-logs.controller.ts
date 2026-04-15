import { Controller, Post, Body, Get, Param, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { DailyLogsService } from './daily-logs.service';
import { CreateDailyLogDto } from './dto/create-daily-log.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ParentsService } from '../parents/parents.service';
import type { Request } from 'express';

interface AuthRequest extends Request {
  user: { userId: string; tenantId: string; roles: string[] };
}

@Controller('daily-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DailyLogsController {
  constructor(
    private readonly dailyLogsService: DailyLogsService,
    private readonly parentsService: ParentsService,
  ) {}

  // POST /daily-logs
  @UseGuards(JwtAuthGuard)
  @Post()
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  async create(@Body() dto: CreateDailyLogDto, @Req() req: AuthRequest) {
    dto.tenant_id = req.user.tenantId;
    dto.logged_by = req.user.userId;
    return this.dailyLogsService.create(dto);
  }

  // POST /daily-logs/bulk
  @UseGuards(JwtAuthGuard)
  @Post('bulk')
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  async createBulk(
    @Body() body: { enrollment_ids: string[]; category: string; log_value: string; notes?: string },
    @Req() req: AuthRequest,
  ) {
    const results: any[] = [];
    for (const enrollmentId of body.enrollment_ids) {
      const dto: CreateDailyLogDto = {
        tenant_id: req.user.tenantId,
        enrollment_id: enrollmentId,
        category: body.category as any,
        log_value: body.log_value,
        notes: body.notes,
        logged_by: req.user.userId,
      };
      results.push(await this.dailyLogsService.create(dto));
    }
    return results;
  }

  // GET /daily-logs/student/:enrollmentId?date=YYYY-MM-DD
  @UseGuards(JwtAuthGuard)
  @Get('student/:enrollmentId')
  async getStudentLogs(
    @Param('enrollmentId') enrollmentId: string,
    @Query('date') date: string,
    @Req() req: AuthRequest,
  ) {
    // If caller is a PARENT, verify they own this enrollment
    if (req.user.roles.includes('PARENT')) {
      await this.parentsService.validateParentOwnsEnrollment(
        req.user.userId,
        enrollmentId,
        req.user.tenantId,
      );
    }
    return this.dailyLogsService.findByStudentAndDate(
      req.user.tenantId,
      enrollmentId,
      date,
    );
  }

  // GET /daily-logs/class/:classId?date=YYYY-MM-DD
  @UseGuards(JwtAuthGuard)
  @Get('class/:classId')
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  async getClassSummary(
    @Param('classId') classId: string,
    @Query('date') date: string,
    @Req() req: AuthRequest,
  ) {
    return this.dailyLogsService.getClassSummary(req.user.tenantId, classId, date);
  }
}
