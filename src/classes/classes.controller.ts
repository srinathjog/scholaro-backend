import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  Param,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { Request } from 'express';

@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @Roles('SCHOOL_ADMIN')
  async create(@Headers('x-tenant-id') tenantId: string, @Body() dto: CreateClassDto) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.classesService.createClass(dto, tenantId);
  }

  @Get()
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  async findAll(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.classesService.getAllClasses(tenantId);
  }

  @Delete(':id')
  @Roles('SCHOOL_ADMIN')
  async deleteClass(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    await this.classesService.deleteClass(id, tenantId);
    return { success: true };
  }
}
