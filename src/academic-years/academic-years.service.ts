import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcademicYear } from './academic-year.entity';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';

@Injectable()
export class AcademicYearsService {
  constructor(
    @InjectRepository(AcademicYear)
    private readonly academicYearRepository: Repository<AcademicYear>,
  ) {}

  async createAcademicYear(
    dto: CreateAcademicYearDto,
    tenantId: string,
  ): Promise<AcademicYear> {
    // Check for duplicate year per tenant
    const existing = await this.academicYearRepository.findOne({
      where: { tenant_id: tenantId, year: dto.year },
    });
    if (existing) {
      throw new ConflictException(
        'Academic year already exists for this tenant',
      );
    }

    // If is_active is true, set all others to false for this tenant
    if (dto.is_active) {
      await this.academicYearRepository.update(
        { tenant_id: tenantId, is_active: true },
        { is_active: false },
      );
    }

    const academicYear = this.academicYearRepository.create({
      ...dto,
      tenant_id: tenantId,
    });
    return this.academicYearRepository.save(academicYear);
  }

  async getAllAcademicYears(tenantId: string): Promise<AcademicYear[]> {
    return this.academicYearRepository.find({
      where: { tenant_id: tenantId },
      order: { start_date: 'ASC' },
    });
  }

  async getActiveAcademicYear(tenantId: string): Promise<AcademicYear | null> {
    return this.academicYearRepository.findOne({
      where: { tenant_id: tenantId, is_active: true },
      order: { start_date: 'DESC' },
    });
  }
}
