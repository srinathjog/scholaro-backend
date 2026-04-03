import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SCHOOL_ADMIN', 'TEACHER')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  async createStudent(
    @Body() createStudentDto: CreateStudentDto,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Missing x-tenant-id header');
    }
    return this.studentsService.createStudent(createStudentDto, tenantId);
  }

  @Get()
  async getAllStudents(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Missing x-tenant-id header');
    }
    return this.studentsService.getAllStudents(tenantId);
  }

  @Get('search-parents')
  @Roles('SCHOOL_ADMIN')
  async searchParents(
    @Query('email') email: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.studentsService.searchParentsByEmail(email, tenantId);
  }

  @Get(':id')
  async getStudentById(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Missing x-tenant-id header');
    }
    const student = await this.studentsService.getStudentById(id, tenantId);
    if (!student) {
      throw new BadRequestException('Student not found');
    }
    return student;
  }

  @Get(':id/detail')
  @Roles('SCHOOL_ADMIN')
  async getStudentDetail(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.studentsService.getStudentDetail(id, tenantId);
  }

  @Post(':id/parents')
  @Roles('SCHOOL_ADMIN')
  async linkParent(
    @Param('id') studentId: string,
    @Body() body: { parent_user_id: string; relationship: string },
    @Headers('x-tenant-id') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.studentsService.linkParentToStudent(
      studentId, body.parent_user_id, body.relationship, tenantId,
    );
  }

  @Post(':id/parents/create')
  @Roles('SCHOOL_ADMIN')
  async createAndLinkParent(
    @Param('id') studentId: string,
    @Body() body: { name: string; email: string; phone?: string; relationship: string },
    @Headers('x-tenant-id') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.studentsService.createAndLinkParent(studentId, body, tenantId);
  }
}
