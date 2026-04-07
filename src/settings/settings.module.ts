import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantSettings } from './setting.entity';
import { Tenant } from '../super-admin/tenant.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { ManifestController } from './manifest.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TenantSettings, Tenant])],
  controllers: [SettingsController, ManifestController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
