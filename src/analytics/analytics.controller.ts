import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('stats')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  async getSchoolStats(@Req() req: any) {
    const tenantId = req.headers['x-tenant-id'];
    return this.analyticsService.getSchoolStats(tenantId);
  }

  @Get('attendance-chart')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  async getAttendanceChart(@Req() req: any) {
    const tenantId = req.headers['x-tenant-id'];
    return this.analyticsService.getAttendanceChart(tenantId);
  }
}
