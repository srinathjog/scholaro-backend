import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';

@Controller('enrollments')
@UseGuards(JwtAuthGuard)
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  async createEnrollment(
    @Body() createEnrollmentDto: CreateEnrollmentDto,
    @Req() req: Request,
  ) {
    const tenantId = (req['tenantId'] as string) || (req as any).user?.tenantId;
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
    const tenantId = (req['tenantId'] as string) || (req as any).user?.tenantId;
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
    const tenantId = (req['tenantId'] as string) || (req as any).user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Missing tenantId in request');
    }
    return this.enrollmentsService.getEnrollmentsByClass(classId, tenantId);
  }

  @Get('section-counts')
  async getSectionStudentCounts(@Req() req: Request) {
    const tenantId = (req['tenantId'] as string) || (req as any).user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Missing tenantId in request');
    }
    return this.enrollmentsService.getSectionStudentCounts(tenantId);
  }

  @Get(':id')
  async getEnrollmentById(@Param('id') id: string, @Req() req: Request) {
    const tenantId = (req['tenantId'] as string) || (req as any).user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Missing tenantId in request');
    }
    return this.enrollmentsService.getEnrollmentById(id, tenantId);
  }
}
