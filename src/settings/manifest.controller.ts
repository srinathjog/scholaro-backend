import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../super-admin/tenant.entity';
import { TenantSettings } from './setting.entity';

const DEFAULT_LOGO = 'https://scholaro-api.up.railway.app/assets/scholaro-default.png';
const DEFAULT_COLOR = '#3B82F6';

@Controller('tenants')
export class ManifestController {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(TenantSettings)
    private readonly settingsRepo: Repository<TenantSettings>,
  ) {}

  @Get('manifest/:code')
  @Header('Content-Type', 'application/manifest+json')
  async getManifest(@Param('code') code: string) {
    const tenant = await this.tenantRepo.findOne({
      where: { tenant_code: code.toUpperCase() },
    });

    if (!tenant) {
      throw new NotFoundException(`School not found for code: ${code}`);
    }

    const settings = await this.settingsRepo.findOne({
      where: { tenant_id: tenant.id },
    });

    const logoUrl = settings?.logo_url || DEFAULT_LOGO;
    const themeColor = settings?.primary_color || DEFAULT_COLOR;
    const fullName = tenant.name;
    const shortName = fullName.length > 12 ? fullName.slice(0, 12) : fullName;

    return {
      name: fullName,
      short_name: shortName,
      start_url: `/login?code=${tenant.tenant_code}&utm_source=pwa`,
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: themeColor,
      icons: [
        { src: logoUrl, sizes: '192x192', type: 'image/png' },
        { src: logoUrl, sizes: '512x512', type: 'image/png' },
      ],
    };
  }
}
