import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Headers,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SchoolDocumentsService } from './school-documents.service';

@Controller('school-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchoolDocumentsController {
  constructor(private readonly service: SchoolDocumentsService) {}

  /** Admin only: upload a PDF or image with a title */
  @Post()
  @Roles('SCHOOL_ADMIN')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/webp',
        ];
        if (!allowed.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Only PDF and image files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @Headers('x-tenant-id') tenantId: string,
    @Body('title') title: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    if (!file) throw new BadRequestException('No file uploaded');
    if (!title?.trim()) throw new BadRequestException('Title is required');
    return this.service.upload(tenantId, title.trim(), file);
  }

  /** Admin, Teacher, Parent: list all documents for this school */
  @Get()
  @Roles('SCHOOL_ADMIN', 'TEACHER', 'PARENT')
  async findAll(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.service.findAll(tenantId);
  }

  /** Admin only: delete a document */
  @Delete(':id')
  @Roles('SCHOOL_ADMIN')
  async remove(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    await this.service.remove(id, tenantId);
    return { success: true };
  }
}
