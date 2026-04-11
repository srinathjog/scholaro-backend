import { Controller, Get, Post, Patch, Body, Param, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SuperAdminService } from './super-admin.service';
import { OnboardSchoolDto } from './dto/onboard-school.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { ResetAdminPasswordDto } from './dto/reset-admin-password.dto';

@Controller('super-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('stats')
  async getPlatformStats() {
    return this.superAdminService.getPlatformStats();
  }

  @Get('tenants')
  async getAllTenants() {
    return this.superAdminService.getAllTenants();
  }

  @Post('onboard')
  async onboardSchool(
    @Body(new ValidationPipe({ whitelist: true })) dto: OnboardSchoolDto,
  ) {
    return this.superAdminService.onboardNewSchool(dto);
  }

  @Patch('tenants/:id/status')
  async updateTenantStatus(
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdateTenantStatusDto,
  ) {
    return this.superAdminService.updateTenantStatus(id, dto.status);
  }

  @Patch('tenants/:id/reset-admin-password')
  async resetAdminPassword(
    @Param('id') tenantId: string,
    @Body(new ValidationPipe({ whitelist: true })) dto: ResetAdminPasswordDto,
  ) {
    return this.superAdminService.resetAdminPassword(tenantId, dto.newPassword);
  }
}
