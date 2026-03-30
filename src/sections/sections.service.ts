import {
  Injectable,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Section } from './section.entity';
import { CreateSectionDto } from './dto/create-section.dto';
import { Class } from '../classes/class.entity';

@Injectable()
export class SectionsService {
  constructor(
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
    @InjectRepository(Class)
    private readonly classRepository: Repository<Class>,
  ) {}

  async createSection(
    dto: CreateSectionDto,
    tenantId: string,
  ): Promise<Section> {
    // Check class exists and belongs to tenant
    const klass = await this.classRepository.findOne({
      where: { id: dto.class_id, tenant_id: tenantId },
    });
    if (!klass) {
      throw new ForbiddenException(
        'Class does not belong to tenant or not found',
      );
    }

    // Prevent duplicate section name within same class for tenant
    const existing = await this.sectionRepository.findOne({
      where: { tenant_id: tenantId, class_id: dto.class_id, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        'Section name already exists in this class for this tenant',
      );
    }

    const section = this.sectionRepository.create({
      ...dto,
      tenant_id: tenantId,
    });
    return this.sectionRepository.save(section);
  }

  async getSectionsByClass(
    classId: string,
    tenantId: string,
  ): Promise<Section[]> {
    // Check class exists and belongs to tenant
    const klass = await this.classRepository.findOne({
      where: { id: classId, tenant_id: tenantId },
    });
    if (!klass) {
      throw new ForbiddenException(
        'Class does not belong to tenant or not found',
      );
    }
    return this.sectionRepository.find({
      where: { tenant_id: tenantId, class_id: classId },
      order: { name: 'ASC' },
    });
  }
}
