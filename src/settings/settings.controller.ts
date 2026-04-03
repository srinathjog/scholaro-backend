import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { Request } from 'express';

interface UserJwt {
  userId: string;
  tenantId: string;
  role: string;
}

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** Any authenticated user can read branding (needed on app startup) */
  @Get('branding')
  async getBranding(@Req() req: Request) {
    const { tenantId } = req.user as UserJwt;
    return this.settingsService.getSettings(tenantId);
  }

  /** Only School Admin can change branding */
  @Patch('branding')
  @Roles('SCHOOL_ADMIN')
  async updateBranding(
    @Body() dto: UpdateBrandingDto,
    @Req() req: Request,
  ) {
    const { tenantId } = req.user as UserJwt;
    return this.settingsService.updateBranding(tenantId, dto);
  }
}
