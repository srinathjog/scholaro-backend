import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchoolDocument } from './school-document.entity';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class SchoolDocumentsService {
  constructor(
    @InjectRepository(SchoolDocument)
    private readonly repo: Repository<SchoolDocument>,
    private readonly storageService: StorageService,
  ) {}

  async upload(
    tenantId: string,
    title: string,
    file: Express.Multer.File,
  ): Promise<SchoolDocument> {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileUrl = await this.storageService.upload(
      file.buffer,
      safeName,
      file.mimetype,
      tenantId,
    );
    const fileType = file.mimetype === 'application/pdf' ? 'pdf' : 'image';
    const doc = this.repo.create({
      tenant_id: tenantId,
      title,
      file_url: fileUrl,
      file_type: fileType,
    });
    return this.repo.save(doc);
  }

  async findAll(tenantId: string): Promise<SchoolDocument[]> {
    return this.repo.find({
      where: { tenant_id: tenantId },
      order: { created_at: 'DESC' },
    });
  }

  async remove(id: string, tenantId: string): Promise<void> {
    await this.repo.delete({ id, tenant_id: tenantId });
  }
}
