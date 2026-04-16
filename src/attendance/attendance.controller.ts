import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { todayIST } from '../utils/date.util';

interface UserJwt {
  userId: string;
  tenantId: string;
  role: string;
}
import type { Request } from 'express';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TEACHER', 'SCHOOL_ADMIN')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  async markAttendance(@Body() dto: MarkAttendanceDto, @Req() req: Request) {
    const { tenantId, userId } = req.user as UserJwt;
    return this.attendanceService.markAttendance(dto, tenantId, userId);
  }

  @Post('bulk')
  async markBulk(
    @Body() body: { enrollment_ids: string[]; date: string; status: 'present' | 'absent' | 'late' | 'leave' },
    @Req() req: Request,
  ) {
    const { tenantId, userId } = req.user as UserJwt;
    return this.attendanceService.markBulk(
      body.enrollment_ids, body.date, body.status, tenantId, userId,
    );
  }

  @Get()
  async getAttendanceByDate(@Query('date') date: string, @Req() req: Request) {
    const { tenantId } = req.user as UserJwt;
    return this.attendanceService.getAttendanceByDate(date, tenantId);
  }

  @Get('class/:classId')
  async getAttendanceByClass(
    @Param('classId') classId: string,
    @Query('date') date: string,
    @Req() req: Request,
  ) {
    const { tenantId } = req.user as UserJwt;
    return this.attendanceService.getAttendanceByClass(classId, date, tenantId);
  }

  @Get('student/:enrollmentId')
  async getAttendanceByStudent(
    @Param('enrollmentId') enrollmentId: string,
    @Req() req: Request,
  ) {
    const { tenantId } = req.user as UserJwt;
    return this.attendanceService.getAttendanceByStudent(
      enrollmentId,
      tenantId,
    );
  }

  @Patch(':id/checkout')
  async checkoutStudent(
    @Param('id') id: string,
    @Body() body: { pickup_by_name: string; pickup_by_photo_url?: string; pickup_notes?: string },
    @Req() req: Request,
  ) {
    const { tenantId, userId } = req.user as UserJwt;
    return this.attendanceService.secureCheckout(
      tenantId, id, body, userId,
    );
  }

  @Post('bulk-present')
  async bulkMarkPresent(
    @Body() body: { enrollment_ids: string[] },
    @Req() req: Request,
  ) {
    const { tenantId, userId } = req.user as UserJwt;
    return this.attendanceService.bulkMarkPresent(
      tenantId, body.enrollment_ids, userId,
    );
  }

  @Get('check-today/:classId')
  async checkToday(
    @Param('classId') classId: string,
    @Req() req: Request,
  ) {
    const { tenantId } = req.user as UserJwt;
    return this.attendanceService.checkToday(classId, tenantId);
  }

  @Get('report/:classId')
  async getDailyReport(
    @Param('classId') classId: string,
    @Query('date') date: string,
    @Req() req: Request,
  ) {
    const { tenantId } = req.user as UserJwt;
    const d = date || todayIST();
    return this.attendanceService.getDailyReport(tenantId, classId, d);
  }

  @Get('report/monthly/:classId')
  @Roles('SCHOOL_ADMIN')
  async getMonthlyReport(
    @Param('classId') classId: string,
    @Query('month') month: string,
    @Query('year') year: string,
    @Req() req: Request,
  ) {
    const { tenantId } = req.user as UserJwt;
    const monthNum = Number(month);
    const yearNum = Number(year);
    if (!month || !year || Number.isNaN(monthNum) || Number.isNaN(yearNum)) {
      throw new BadRequestException('month and year query parameters are required');
    }
    return await this.attendanceService.getMonthlyReport(tenantId, classId, monthNum, yearNum);
  }

  @Post('broadcast-arrival')
  async broadcastArrival(
    @Body() body: { class_id: string; date: string },
    @Req() req: Request,
  ) {
    const { tenantId } = req.user as UserJwt;
    return this.attendanceService.broadcastArrival(
      body.class_id, body.date, tenantId,
    );
  }

  @Post('bulk-checkout')
  async bulkCheckout(
    @Body() body: { attendance_ids: string[] },
    @Req() req: Request,
  ) {
    const { tenantId, userId } = req.user as UserJwt;
    return this.attendanceService.bulkCheckout(
      tenantId, body.attendance_ids, userId,
    );
  }
}
