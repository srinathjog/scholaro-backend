import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from './student.entity';
import { CreateStudentDto } from './dto/create-student.dto';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
  ) {}

  async createStudent(
    createStudentDto: CreateStudentDto,
    tenantId: string,
  ): Promise<Student> {
    const student = this.studentRepository.create({
      ...createStudentDto,
      tenant_id: tenantId,
    });
    return this.studentRepository.save(student);
  }

  async getAllStudents(tenantId: string): Promise<Student[]> {
    return this.studentRepository.find({ where: { tenant_id: tenantId } });
  }

  async getStudentById(id: string, tenantId: string): Promise<Student | null> {
    return this.studentRepository.findOne({
      where: { id, tenant_id: tenantId },
    });
  }
}
