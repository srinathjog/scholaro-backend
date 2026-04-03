import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeacherAssignment } from './teacher-assignment.entity';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { Class } from '../classes/class.entity';
import { Section } from '../sections/section.entity';
import { AcademicYear } from '../academic-years/academic-year.entity';

@Injectable()
export class TeacherAssignmentsService {
  constructor(
    @InjectRepository(TeacherAssignment)
    private readonly assignmentRepo: Repository<TeacherAssignment>,
    @InjectRepository(Class)
    private readonly classRepo: Repository<Class>,
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
    @InjectRepository(AcademicYear)
    private readonly academicYearRepo: Repository<AcademicYear>,
  ) {}

  async assignTeacher(dto: CreateTeacherAssignmentDto, tenantId: string) {
    // 1. Validate teacher belongs to tenant (assume teacher_id is a user id in teachers table)
    // You must implement Teacher entity/repo for this check in production
    // For now, skip or add a TODO

    // 2. Validate class belongs to tenant
    const klass = await this.classRepo.findOne({
      where: { id: dto.class_id, tenant_id: tenantId },
    });
    if (!klass) throw new NotFoundException('Class not found for tenant');

    // 3. Validate section belongs to tenant (if provided)
    if (dto.section_id) {
      const section = await this.sectionRepo.findOne({
        where: {
          id: dto.section_id,
          tenant_id: tenantId,
          class_id: dto.class_id,
        },
      });
      if (!section)
        throw new NotFoundException('Section not found for tenant/class');
    }

    // 4. Validate academic year belongs to tenant
    const academicYear = await this.academicYearRepo.findOne({
      where: { id: dto.academic_year_id, tenant_id: tenantId },
    });
    if (!academicYear)
      throw new NotFoundException('Academic year not found for tenant');

    // 5. Prevent duplicate assignment
    const exists = await this.assignmentRepo.findOne({
      where: {
        teacher_id: dto.teacher_id,
        class_id: dto.class_id,
        section_id: dto.section_id ?? undefined,
        academic_year_id: dto.academic_year_id,
        tenant_id: tenantId,
      },
    });
    if (exists) throw new ConflictException('Duplicate teacher assignment');

    // 6. Create assignment
    const assignment = this.assignmentRepo.create({
      ...dto,
      tenant_id: tenantId,
    });
    return this.assignmentRepo.save(assignment);
  }

  async getAssignmentsByTeacher(teacherId: string, tenantId: string) {
    return this.assignmentRepo.find({
      where: { teacher_id: teacherId, tenant_id: tenantId },
      relations: ['assignedClass', 'section'],
    });
  }

  async getAssignmentsByClass(classId: string, tenantId: string) {
    return this.assignmentRepo.find({
      where: { class_id: classId, tenant_id: tenantId },
    });
  }

  async getAllAssignments(tenantId: string) {
    return this.assignmentRepo.find({
      where: { tenant_id: tenantId },
      relations: ['assignedClass', 'section'],
      order: { created_at: 'DESC' },
    });
  }

  async deleteAssignment(id: string, tenantId: string) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.assignmentRepo.remove(assignment);
  }
}
