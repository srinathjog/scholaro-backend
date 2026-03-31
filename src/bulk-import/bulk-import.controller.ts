import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BulkImportService } from './bulk-import.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('bulk-import')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BulkImportController {
  constructor(private readonly bulkImportService: BulkImportService) {}

  /**
   * POST /bulk-import/teachers
   * Accepts Excel/CSV file and tenant_id
   * Only SCHOOL_ADMIN or SUPER_ADMIN can access
   */
  @Post('teachers')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  async importTeachers(
    @UploadedFile() file: { buffer: Buffer },
    @Body('tenant_id') tenantId: string,
  ) {
    if (!file || !(file.buffer instanceof Buffer)) {
      throw new BadRequestException('No file uploaded');
    }
    if (!tenantId) {
      throw new BadRequestException('tenant_id is required');
    }
    return this.bulkImportService.importTeachers(file.buffer, tenantId);
  }

  /**
   * POST /bulk-import/students
   * Accepts Excel/CSV file and tenant_id
   * Only SCHOOL_ADMIN or SUPER_ADMIN can access
   */
  @Post('students')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  async importStudents(
    @UploadedFile() file: { buffer: Buffer },
    @Body('tenant_id') tenantId: string,
  ) {
    if (!file || !(file.buffer instanceof Buffer)) {
      throw new BadRequestException('No file uploaded');
    }
    if (!tenantId) {
      throw new BadRequestException('tenant_id is required');
    }
    return this.bulkImportService.importStudents(file.buffer, tenantId);
  }
}
