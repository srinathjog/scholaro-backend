import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Enrollment } from './enrollment.entity';
import { Fee } from '../fees/fee.entity';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

@Injectable()
export class EnrollmentsService {
  private readonly logger = new Logger(EnrollmentsService.name);

  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(Fee)
    private readonly feeRepository: Repository<Fee>,
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

  async getEnrollmentsByClass(classId: string, tenantId: string): Promise<Enrollment[]> {
    const enrollments = await this.enrollmentRepository.find({
      where: { class_id: classId, tenant_id: tenantId, status: 'active' },
      relations: ['student'],
      order: { roll_number: 'ASC' },
    });
    // Exclude inactive students from teacher-facing views
    return enrollments.filter(e => e.student?.status !== 'inactive');
  }

  async getSectionStudentCounts(tenantId: string): Promise<Array<{ section_id: string; count: number }>> {
    const result = await this.enrollmentRepository
      .createQueryBuilder('e')
      .select('e.section_id', 'section_id')
      .addSelect('COUNT(*)::int', 'count')
      .where('e.tenant_id = :tenantId', { tenantId })
      .andWhere('e.status = :status', { status: 'active' })
      .groupBy('e.section_id')
      .getRawMany();
    return result;
  }

  async updateCustomFee(
    id: string,
    tenantId: string,
    customFeeAmount: number | null,
  ): Promise<Enrollment> {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }
    enrollment.custom_fee_amount = customFeeAmount != null ? String(customFeeAmount) : null;
    const saved = await this.enrollmentRepository.save(enrollment);

    // Update all pending/overdue fee invoices for this enrollment
    if (customFeeAmount != null) {
      const pendingFees = await this.feeRepository.find({
        where: {
          enrollment_id: id,
          tenant_id: tenantId,
          status: In(['pending', 'overdue']),
        },
      });

      for (const fee of pendingFees) {
        fee.total_amount = customFeeAmount;
        fee.final_amount = customFeeAmount - Number(fee.discount_amount);
      }

      if (pendingFees.length > 0) {
        await this.feeRepository.save(pendingFees);
        this.logger.log(
          `Updated ${pendingFees.length} pending fee(s) to custom amount ₹${customFeeAmount} for enrollment ${id}`,
        );
      }
    }

    return saved;
  }
}
