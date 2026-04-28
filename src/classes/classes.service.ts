import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Class } from './class.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { Enrollment } from '../enrollments/enrollment.entity';
import { Section } from '../sections/section.entity';

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(Class)
    private readonly classRepository: Repository<Class>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
  ) {}

  async createClass(dto: CreateClassDto, tenantId: string): Promise<Class> {
    // Prevent duplicate class name per tenant
    const existing = await this.classRepository.findOne({
      where: { tenant_id: tenantId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException('Class name already exists for this tenant');
    }
    const newClass = this.classRepository.create({
      ...dto,
      tenant_id: tenantId,
    });
    return this.classRepository.save(newClass);
  }

  async getAllClasses(tenantId: string): Promise<Class[]> {
    return this.classRepository.find({
      where: { tenant_id: tenantId },
      order: { name: 'ASC' },
    });
  }

  async deleteClass(id: string, tenantId: string): Promise<void> {
    const cls = await this.classRepository.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!cls) throw new NotFoundException('Class not found');

    const enrollmentCount = await this.enrollmentRepository.count({
      where: { class_id: id, tenant_id: tenantId },
    });
    if (enrollmentCount > 0) {
      throw new BadRequestException(
        'Cannot delete class with active students. Please unenroll all students first.',
      );
    }

    // Delete sections belonging to this class first (FK constraint)
    await this.sectionRepository.delete({ class_id: id, tenant_id: tenantId });

    await this.classRepository.delete({ id, tenant_id: tenantId });
  }
}
