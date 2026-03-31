import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';

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

  @Get()
  async getAttendanceByDate(@Query('date') date: string, @Req() req: Request) {
    const { tenantId } = req.user as UserJwt;
    return this.attendanceService.getAttendanceByDate(date, tenantId);
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
}
