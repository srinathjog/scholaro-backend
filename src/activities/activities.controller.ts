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
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { ActivitiesService } from './activities.service';
import { CreateActivityWithMediaDto } from './dto/create-activity-with-media.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';

interface AuthRequest extends Request {
  user: { userId: string; tenantId: string; roles: string[] };
}

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDir = join(process.cwd(), 'uploads', 'activities');
          mkdirSync(uploadDir, { recursive: true });
          cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
          const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
          const uniqueName = `${Date.now()}_${safeName}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const urls = files.map(
      (f) => `${baseUrl}/uploads/activities/${f.filename}`,
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
    @Req() req: AuthRequest,
  ) {
    return this.activitiesService.getFeed(req.user.tenantId, classId);
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
