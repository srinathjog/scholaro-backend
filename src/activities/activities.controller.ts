import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Param,
  Delete,
  HttpCode,
  UseInterceptors,
  UseGuards,
  UploadedFiles,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ActivitiesService } from './activities.service';
import { CreateActivityWithMediaDto } from './dto/create-activity-with-media.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StorageService } from '../storage/storage.service';
import type { Request } from 'express';

interface AuthRequest extends Request {
  user: { userId: string; tenantId: string; roles: string[] };
}

@Controller('activities')
export class ActivitiesController {
  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly storageService: StorageService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: AuthRequest,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const tenantId = req.user.tenantId;
    const urls = await Promise.all(
      files.map((f) => {
        const safeName = f.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        return this.storageService.upload(f.buffer, safeName, f.mimetype, tenantId);
      }),
    );

    return { urls };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() dto: CreateActivityWithMediaDto,
    @Req() req: AuthRequest,
  ) {
    dto.tenant_id = req.user.tenantId;
    dto.created_by = req.user.userId;
    return this.activitiesService.createActivity(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('feed')
  async getFeed(
    @Query('class_id') classId: string,
    @Query('enrollment_id') enrollmentId: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: AuthRequest,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(50, Math.max(1, parseInt(limit || '10', 10) || 10));
    return this.activitiesService.getFeed(req.user.tenantId, classId, enrollmentId, p, l);
  }

  @UseGuards(JwtAuthGuard)
  @Get('teacher/:userId')
  async getTeacherActivities(
    @Param('userId') userId: string,
    @Req() req: AuthRequest,
  ) {
    return this.activitiesService.getTeacherActivities(req.user.tenantId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(204)
  async deleteActivity(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ) {
    return this.activitiesService.deleteActivity(id, req.user.tenantId);
  }
}
