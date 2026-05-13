import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassPlanner } from './class-planner.entity';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ClassPlannersService {
  constructor(
    @InjectRepository(ClassPlanner)
    private readonly repo: Repository<ClassPlanner>,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Upload (or replace) the monthly planner for a class.
   * If a planner already exists for the same tenant/class/month/year it is deleted
   * first so there is always at most one per class per month.
   */
  async upload(
    tenantId: string,
    classId: string,
    sectionId: string | null,
    month: string,
    year: number,
    uploadedBy: string,
    file: Express.Multer.File,
  ): Promise<ClassPlanner> {
    // Remove any previous planner for this class + month/year
    await this.repo.delete({ tenant_id: tenantId, class_id: classId, month, year });

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileUrl = await this.storageService.uploadDocument(
      file.buffer,
      safeName,
      file.mimetype,
      tenantId,
    );
    const fileType = file.mimetype === 'application/pdf' ? 'pdf' : 'image';

    const planner = this.repo.create({
      tenant_id: tenantId,
      class_id: classId,
      section_id: sectionId ?? undefined,
      file_url: fileUrl,
      file_type: fileType,
      month,
      year,
      uploaded_by: uploadedBy,
    });
    return this.repo.save(planner);
  }

  /** Returns the planner for a specific class + month/year, or null if none uploaded. */
  async findForClass(
    tenantId: string,
    classId: string,
    month: string,
    year: number,
  ): Promise<ClassPlanner | null> {
    return this.repo.findOne({
      where: { tenant_id: tenantId, class_id: classId, month, year },
      order: { created_at: 'DESC' },
    });
  }

  /** Returns all planners for a teacher's class (most recent first). */
  async findAllForClass(
    tenantId: string,
    classId: string,
  ): Promise<ClassPlanner[]> {
    return this.repo.find({
      where: { tenant_id: tenantId, class_id: classId },
      order: { year: 'DESC', created_at: 'DESC' },
    });
  }

  async remove(id: string, tenantId: string): Promise<void> {
    await this.repo.delete({ id, tenant_id: tenantId });
  }
}
