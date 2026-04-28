import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead, LeadStatus } from './lead.entity';
import { Tenant } from '../super-admin/tenant.entity';
import { CreateLeadDto } from './create-lead.dto';
import { UpdateLeadDto } from './update-lead.dto';

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadsRepo: Repository<Lead>,
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
  ) {}

  /**
   * Resolve a tenant_code or tenant UUID to the tenant's UUID.
   * Throws 404 if no active tenant is found.
   */
  async resolveTenantCode(code: string): Promise<string> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);
    const where = isUuid
      ? { id: code, status: 'active' as const }
      : { tenant_code: code.toUpperCase(), status: 'active' as const };
    const tenant = await this.tenantsRepo.findOne({ where, select: ['id'] });
    if (!tenant) throw new NotFoundException(`School code "${code}" not found`);
    return tenant.id;
  }

  /** Submit from public QR-code form using a school code instead of a UUID. */
  async createByCode(tenantCode: string, dto: CreateLeadDto): Promise<Lead> {
    const tenantId = await this.resolveTenantCode(tenantCode);
    return this.createPublic(tenantId, dto);
  }

  /** Submit an inquiry from the public QR-code form (no auth required). */
  async createPublic(tenantId: string, dto: CreateLeadDto): Promise<Lead> {
    const lead = this.leadsRepo.create({
      ...dto,
      tenant_id: tenantId,
      status: LeadStatus.NEW,
    });
    return this.leadsRepo.save(lead);
  }

  /** Return all leads for a tenant, newest first. */
  async findAll(tenantId: string): Promise<Lead[]> {
    return this.leadsRepo.find({
      where: { tenant_id: tenantId },
      order: { created_at: 'DESC' },
    });
  }

  /** Return a single lead belonging to the tenant. */
  async findOne(tenantId: string, id: string): Promise<Lead> {
    const lead = await this.leadsRepo.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  /** Update status and/or notes for an existing lead. */
  async update(tenantId: string, id: string, dto: UpdateLeadDto): Promise<Lead> {
    const lead = await this.findOne(tenantId, id);
    if (dto.status !== undefined) lead.status = dto.status;
    if (dto.notes !== undefined) lead.notes = dto.notes;
    return this.leadsRepo.save(lead);
  }

  /** Delete a lead permanently. */
  async remove(tenantId: string, id: string): Promise<void> {
    const lead = await this.findOne(tenantId, id);
    await this.leadsRepo.remove(lead);
  }
}
