import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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

  /** Convert e.g. 'NURSERY' or 'nursery' → 'Nursery' */
  private toTitleCase(str: string): string {
    return str
      .trim()
      .replace(
        /\w\S*/g,
        (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
      );
  }

  /** Canonical key used for duplicate detection: strip spaces, lowercase.
   *  'NURSERY' = 'Nursery' = 'nursery'; 'SUMMERCAMP' = 'Summer Camp' = 'summercamp' */
  private normalizeKey(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, '');
  }

  async createClass(dto: CreateClassDto, tenantId: string): Promise<Class> {
    const displayName = this.toTitleCase(dto.name);
    const inputKey = this.normalizeKey(dto.name);

    // Fetch all classes for this tenant and compare by normalized key so that
    // 'NURSERY', 'nursery', 'SUMMERCAMP' and 'Summer Camp' all resolve as duplicates.
    const allClasses = await this.classRepository.find({
      where: { tenant_id: tenantId },
    });
    const duplicate = allClasses.find(
      (c) => this.normalizeKey(c.name) === inputKey,
    );
    if (duplicate) {
      throw new ConflictException(
        `Class "${duplicate.name}" already exists for this school`,
      );
    }

    const newClass = this.classRepository.create({
      ...dto,
      name: displayName,
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

    // Step 1: find sections that belong to this class.
    const sections = await this.sectionRepository.find({
      where: { class_id: id, tenant_id: tenantId },
    });

    // Step 2a: count students in sections
    let activeCount = 0;
    if (sections.length > 0) {
      const sectionIds = sections.map((s) => s.id);
      activeCount += await this.enrollmentRepository
        .createQueryBuilder('e')
        .where('e.section_id IN (:...sectionIds)', { sectionIds })
        .andWhere('e.tenant_id = :tenantId', { tenantId })
        .andWhere('e.status = :status', { status: 'active' })
        .getCount();
    }

    // Step 2b: also count students enrolled directly to the class with no section
    activeCount += await this.enrollmentRepository
      .createQueryBuilder('e')
      .where('e.class_id = :id', { id })
      .andWhere('e.section_id IS NULL')
      .andWhere('e.tenant_id = :tenantId', { tenantId })
      .andWhere('e.status = :status', { status: 'active' })
      .getCount();

    if (activeCount > 0) {
      throw new BadRequestException(
        'Cannot delete class with active students. Please unenroll all students first.',
      );
    }

    // Remove all enrollments referencing this class (including orphan records)
    await this.enrollmentRepository.delete({
      class_id: id,
      tenant_id: tenantId,
    });
    // Delete sections first (FK constraint)
    await this.sectionRepository.delete({ class_id: id, tenant_id: tenantId });
    await this.classRepository.delete({ id, tenant_id: tenantId });
  }
}
