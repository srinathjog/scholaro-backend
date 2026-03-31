import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { TeacherAssignmentsService } from './teacher-assignments.service';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { Request } from 'express';

interface UserJwt {
  userId: string;
  tenantId: string;
  role: string;
}

@Controller('teacher-assignments')
export class TeacherAssignmentsController {
  constructor(private readonly service: TeacherAssignmentsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN')
  @Post()
  async assignTeacher(
    @Body() dto: CreateTeacherAssignmentDto,
    @Req() req: Request & { user: UserJwt },
  ) {
    const tenantIdRaw = req.user.tenantId || req.headers['x-tenant-id'];
    const tenantId =
      typeof tenantIdRaw === 'string'
        ? tenantIdRaw
        : Array.isArray(tenantIdRaw)
          ? tenantIdRaw[0]
          : undefined;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    return this.service.assignTeacher(dto, tenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('teacher/:teacherId')
  async getAssignmentsByTeacher(
    @Param('teacherId') teacherId: string,
    @Req() req: Request & { user: UserJwt },
  ) {
    const tenantIdRaw = req.user.tenantId || req.headers['x-tenant-id'];
    const tenantId =
      typeof tenantIdRaw === 'string'
        ? tenantIdRaw
        : Array.isArray(tenantIdRaw)
          ? tenantIdRaw[0]
          : undefined;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    return this.service.getAssignmentsByTeacher(teacherId, tenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('class/:classId')
  async getAssignmentsByClass(
    @Param('classId') classId: string,
    @Req() req: Request & { user: UserJwt },
  ) {
    const tenantIdRaw = req.user.tenantId || req.headers['x-tenant-id'];
    const tenantId =
      typeof tenantIdRaw === 'string'
        ? tenantIdRaw
        : Array.isArray(tenantIdRaw)
          ? tenantIdRaw[0]
          : undefined;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    return this.service.getAssignmentsByClass(classId, tenantId);
  }
}
