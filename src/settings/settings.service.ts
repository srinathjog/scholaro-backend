import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantSettings } from './setting.entity';
import { UpdateBrandingDto } from './dto/update-branding.dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  /** In-memory cache: tenant_id → branding payload */
  private cache = new Map<string, { data: Partial<TenantSettings>; expiresAt: number }>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(TenantSettings)
    private readonly repo: Repository<TenantSettings>,
  ) {}

  async getSettings(tenantId: string): Promise<Partial<TenantSettings>> {
    // Check cache first
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    let settings = await this.repo.findOne({ where: { tenant_id: tenantId } });

    // Auto-create default row if none exists
    if (!settings) {
      try {
        settings = this.repo.create({
          tenant_id: tenantId,
          primary_color: '#3B82F6',
          secondary_color: '#10B981',
          contact_phone: '',
        });
        settings = await this.repo.save(settings);
        this.logger.log(`Created default settings for tenant ${tenantId}`);
      } catch {
        // FK violation or other DB error — return defaults without persisting
        this.logger.warn(`Could not auto-create settings for tenant ${tenantId}, returning defaults`);
        const defaults = {
          id: '',
          tenant_id: tenantId,
          logo_url: null,
          primary_color: '#3B82F6',
          secondary_color: '#10B981',
          school_motto: null,
          contact_phone: '',
          updated_at: new Date(),
        };
        this.cache.set(tenantId, { data: defaults, expiresAt: Date.now() + this.TTL_MS });
        return defaults;
      }
    }

    const data = {
      id: settings.id,
      tenant_id: settings.tenant_id,
      logo_url: settings.logo_url,
      primary_color: settings.primary_color,
      secondary_color: settings.secondary_color,
      school_motto: settings.school_motto,
      contact_phone: settings.contact_phone,
      updated_at: settings.updated_at,
    };

    this.cache.set(tenantId, { data, expiresAt: Date.now() + this.TTL_MS });
    return data;
  }

  async updateBranding(
    tenantId: string,
    dto: UpdateBrandingDto,
  ): Promise<Partial<TenantSettings>> {
    let settings = await this.repo.findOne({ where: { tenant_id: tenantId } });

    if (!settings) {
      settings = this.repo.create({
        tenant_id: tenantId,
        primary_color: '#3B82F6',
        secondary_color: '#10B981',
        contact_phone: '',
      });
    }

    Object.assign(settings, dto);
    const saved = await this.repo.save(settings);

    // Invalidate cache so next read picks up fresh data
    this.cache.delete(tenantId);

    this.logger.log(`Updated branding for tenant ${tenantId}`);
    return this.getSettings(tenantId); // re-populate cache
  }
}
