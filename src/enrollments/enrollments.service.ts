import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enrollment } from './enrollment.entity';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
  ) {}

  async enrollmentExists(
    studentId: string,
    academicYearId: string,
    tenantId: string,
  ): Promise<boolean> {
    const existing = await this.enrollmentRepository.findOne({
      where: {
        student_id: studentId,
        academic_year_id: academicYearId,
        tenant_id: tenantId,
      },
    });
    return !!existing;
  }

  async createEnrollment(
    createEnrollmentDto: CreateEnrollmentDto,
    tenantId: string,
  ): Promise<Enrollment> {
    // Prevent duplicate enrollment for same student and academic_year_id
    const existing = await this.enrollmentRepository.findOne({
      where: {
        student_id: createEnrollmentDto.student_id,
        academic_year_id: createEnrollmentDto.academic_year_id,
        tenant_id: tenantId,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Duplicate enrollment for this student and academic year',
      );
    }
    const enrollment = this.enrollmentRepository.create({
      ...createEnrollmentDto,
      tenant_id: tenantId,
    });
    return this.enrollmentRepository.save(enrollment);
  }

  async getAllEnrollments(tenantId: string): Promise<Enrollment[]> {
    return this.enrollmentRepository.find({ where: { tenant_id: tenantId } });
  }

  async getEnrollmentById(id: string, tenantId: string): Promise<Enrollment> {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }
    return enrollment;
  }
}
