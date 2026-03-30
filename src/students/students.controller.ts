import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';

@Controller('students')
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
