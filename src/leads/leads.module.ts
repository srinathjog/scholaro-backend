import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lead } from './lead.entity';
import { Tenant } from '../super-admin/tenant.entity';
import { LeadsService } from './leads.service';
import { LeadsController, PublicLeadsController } from './leads.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Lead, Tenant])],
  providers: [LeadsService],
  controllers: [LeadsController, PublicLeadsController],
})
export class LeadsModule {}
