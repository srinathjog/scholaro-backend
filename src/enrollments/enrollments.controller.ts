import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import type { Request } from 'express';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  async createEnrollment(
    @Body() createEnrollmentDto: CreateEnrollmentDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string | undefined;
    if (!tenantId) {
      throw new BadRequestException('Missing tenantId in request');
    }
    return this.enrollmentsService.createEnrollment(
      createEnrollmentDto,
      tenantId,
    );
  }

  @Get()
  async getAllEnrollments(@Req() req: Request) {
    const tenantId = req['tenantId'] as string | undefined;
    if (!tenantId) {
      throw new BadRequestException('Missing tenantId in request');
    }
    return this.enrollmentsService.getAllEnrollments(tenantId);
  }

  @Get('class/:classId')
  async getEnrollmentsByClass(
    @Param('classId') classId: string,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string | undefined;
    if (!tenantId) {
      throw new BadRequestException('Missing tenantId in request');
    }
    return this.enrollmentsService.getEnrollmentsByClass(classId, tenantId);
  }

  @Get(':id')
  async getEnrollmentById(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string | undefined;
    if (!tenantId) {
      throw new BadRequestException('Missing tenantId in request');
    }
    return this.enrollmentsService.getEnrollmentById(id, tenantId);
  }
}
