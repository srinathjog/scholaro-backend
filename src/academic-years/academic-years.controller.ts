import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { Request } from 'express';

@Controller('academic-years')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicYearsController {
  constructor(private readonly academicYearsService: AcademicYearsService) {}

  @Post()
  @Roles('SCHOOL_ADMIN')
  async create(@Body() dto: CreateAcademicYearDto, @Req() req: Request) {
    const tenantId = (req['tenantId'] as string) || (req as any).user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    return this.academicYearsService.createAcademicYear(dto, tenantId);
  }

  @Get()
  async findAll(@Req() req: Request) {
    const tenantId = (req['tenantId'] as string) || (req as any).user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    return this.academicYearsService.getAllAcademicYears(tenantId);
  }

  @Get('active')
  async getActive(@Req() req: Request) {
    const tenantId = (req['tenantId'] as string) || (req as any).user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    return this.academicYearsService.getActiveAcademicYear(tenantId);
  }

  @Patch(':id/set-active')
  @Roles('SCHOOL_ADMIN')
  async setActive(@Param('id') id: string, @Req() req: Request) {
    const tenantId = (req['tenantId'] as string) || (req as any).user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    return this.academicYearsService.setActiveAcademicYear(id, tenantId);
  }
}
