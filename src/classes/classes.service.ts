import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Class } from './class.entity';
import { CreateClassDto } from './dto/create-class.dto';

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(Class)
    private readonly classRepository: Repository<Class>,
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
}
