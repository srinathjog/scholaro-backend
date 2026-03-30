import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import type { Request } from 'express';

@Controller('academic-years')
export class AcademicYearsController {
  constructor(private readonly academicYearsService: AcademicYearsService) {}

  @Post()
  async create(@Body() dto: CreateAcademicYearDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    return this.academicYearsService.createAcademicYear(dto, tenantId);
  }

  @Get()
  async findAll(@Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    return this.academicYearsService.getAllAcademicYears(tenantId);
  }

  @Get('active')
  async getActive(@Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    return this.academicYearsService.getActiveAcademicYear(tenantId);
  }
}
