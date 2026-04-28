import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SettingsService } from './settings.service';
import { StorageService } from '../storage/storage.service';
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
  constructor(
    private readonly settingsService: SettingsService,
    private readonly storageService: StorageService,
  ) {}

  /** Any authenticated user can read branding (needed on app startup) */
  @Get('branding')
  async getBranding(@Req() req: Request) {
    const { tenantId } = req.user as UserJwt;
    return this.settingsService.getSettings(tenantId);
  }

  /** Upload school logo to Supabase Storage, returns { url } */
  @Post('branding/logo')
  @Roles('SCHOOL_ADMIN')
  @UseInterceptors(FileInterceptor('logo', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('Only image files are allowed');
    const { tenantId } = req.user as UserJwt;
    const url = await this.storageService.upload(file.buffer, file.originalname, file.mimetype, tenantId);
    return { url };
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
