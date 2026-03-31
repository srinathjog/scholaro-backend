import {
  Controller,
  Post,
  Get,
  Param,
  Body,
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
}
