import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Headers,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ClassPlannersService } from './class-planners.service';

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

@Controller('planners')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassPlannersController {
  constructor(private readonly service: ClassPlannersService) {}

  /**
   * Teacher uploads a monthly planner for their class.
   * FormData fields: class_id, month, year, section_id (optional)
   */
  @Post()
  @Roles('TEACHER')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (_req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
          return cb(new BadRequestException('Only PDF and image files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @Headers('x-tenant-id') tenantId: string,
    @Body('class_id') classId: string,
    @Body('month') month: string,
    @Body('year') yearStr: string,
    @Body('section_id') sectionId: string | undefined,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    if (!classId?.trim()) throw new BadRequestException('class_id is required');
    if (!month || !MONTHS.includes(month)) throw new BadRequestException('Invalid month');
    const year = parseInt(yearStr, 10);
    if (!year || year < 2020 || year > 2100) throw new BadRequestException('Invalid year');
    if (!file) throw new BadRequestException('No file uploaded');

    const uploadedBy: string = req.user?.userId ?? req.user?.sub;
    if (!uploadedBy) throw new BadRequestException('Could not identify uploading teacher');

    return this.service.upload(
      tenantId,
      classId.trim(),
      sectionId?.trim() || null,
      month,
      year,
      uploadedBy,
      file,
    );
  }

  /**
   * Get the planner for a specific class + month + year.
   * Used by both teacher (preview) and parent (view in schedule tab).
   * Query params: class_id, month, year
   */
  @Get()
  @Roles('TEACHER', 'PARENT', 'SCHOOL_ADMIN')
  async findForClass(
    @Headers('x-tenant-id') tenantId: string,
    @Query('class_id') classId: string,
    @Query('month') month: string,
    @Query('year') yearStr: string,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    if (!classId) throw new BadRequestException('class_id is required');
    if (!month) throw new BadRequestException('month is required');
    if (!yearStr) throw new BadRequestException('year is required');

    const year = parseInt(yearStr, 10);
    return this.service.findForClass(tenantId, classId, month, year);
  }

  /**
   * Get all planners for a class (teacher's history view).
   * Query param: class_id
   */
  @Get('history')
  @Roles('TEACHER', 'SCHOOL_ADMIN')
  async findAllForClass(
    @Headers('x-tenant-id') tenantId: string,
    @Query('class_id') classId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    if (!classId) throw new BadRequestException('class_id is required');
    return this.service.findAllForClass(tenantId, classId);
  }

  /** Teacher or Admin: delete a planner entry. */
  @Delete(':id')
  @Roles('TEACHER', 'SCHOOL_ADMIN')
  async remove(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    await this.service.remove(id, tenantId);
    return { success: true };
  }
}
