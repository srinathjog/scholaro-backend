import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CalendarService } from './calendar.service';

interface UserJwt {
  userId: string;
  tenantId: string;
}

@Controller('calendar')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  /** GET /calendar — all roles can view the school calendar */
  @Get()
  @Roles('PARENT', 'TEACHER', 'SCHOOL_ADMIN')
  async getEvents(
    @Req() req: Request,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const { tenantId } = req.user as UserJwt;
    return this.calendarService.getEvents(tenantId, month, year);
  }

  /** POST /calendar/bulk-upload — admin only */
  @Post('bulk-upload')
  @Roles('SCHOOL_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  async bulkUpload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const { tenantId } = req.user as UserJwt;
    return this.calendarService.bulkUploadEvents(file.buffer, tenantId);
  }
}
