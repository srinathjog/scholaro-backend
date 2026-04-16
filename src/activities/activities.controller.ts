import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Param,
  Delete,
  Patch,
  HttpCode,
  UseInterceptors,
  UseGuards,
  UploadedFiles,
  Req,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ActivitiesService } from './activities.service';
import { CreateActivityWithMediaDto } from './dto/create-activity-with-media.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StorageService } from '../storage/storage.service';
import { ParentsService } from '../parents/parents.service';
import type { Request } from 'express';

interface AuthRequest extends Request {
  user: { userId: string; tenantId: string; roles: string[] };
}

@Controller('activities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivitiesController {
  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly storageService: StorageService,
    private readonly parentsService: ParentsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @Roles('SCHOOL_ADMIN', 'TEACHER')
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
  @Roles('SCHOOL_ADMIN', 'TEACHER')
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
    // If caller is a PARENT, verify they own the enrollment or have a child in the class
    if (req.user.roles.includes('PARENT')) {
      if (enrollmentId) {
        await this.parentsService.validateParentOwnsEnrollment(
          req.user.userId,
          enrollmentId,
          req.user.tenantId,
        );
      } else if (classId) {
        const enrollmentIds = await this.parentsService.getParentEnrollmentIds(
          req.user.userId,
          req.user.tenantId,
        );
        if (!enrollmentIds.length) {
          throw new ForbiddenException('You do not have access to this class');
        }
      }
    }
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(50, Math.max(1, parseInt(limit || '10', 10) || 10));
    return this.activitiesService.getFeed(req.user.tenantId, classId, enrollmentId, p, l);
  }

  @UseGuards(JwtAuthGuard)
  @Get('teacher/:userId')
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  async getTeacherActivities(
    @Param('userId') userId: string,
    @Req() req: AuthRequest,
  ) {
    return this.activitiesService.getTeacherActivities(req.user.tenantId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getActivityById(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ) {
    return this.activitiesService.getActivityById(id, req.user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  @HttpCode(204)
  async deleteActivity(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ) {
    return this.activitiesService.deleteActivity(id, req.user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  async updateActivity(
    @Param('id') id: string,
    @Body() updateDto: Partial<{ title: string; description: string; class_id: string; section_id: string }>,
    @Req() req: AuthRequest,
  ) {
    return this.activitiesService.updateActivity(id, req.user.tenantId, updateDto);
  }
}
