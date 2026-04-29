import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Headers,
  BadRequestException,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './create-lead.dto';
import { UpdateLeadDto } from './update-lead.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

/** Body shape for the public QR-code submission endpoint. */
class PublicSubmitDto extends CreateLeadDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(36) // accommodates both short codes (≤20) and full UUIDs (36 chars)
  tenant_code!: string;
}

/**
 * Public endpoint — no JWT required.
 *
 * POST /public/inquiries/submit
 * Body: { tenant_code: string, ...CreateLeadDto }
 *
 * The school prints a QR code pointing to their frontend form which calls this.
 * tenant_code (e.g. "LAUREL") is resolved to a tenant UUID server-side so no
 * internal IDs are ever exposed in the QR code URL.
 */
@Controller('public/inquiries')
export class PublicLeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post('submit')
  async submit(@Body() body: PublicSubmitDto) {
    return this.leadsService.createByCode(body.tenant_code, body);
  }
}

/**
 * Admin-only endpoints — protected by JWT + SCHOOL_ADMIN role.
 */
@Controller('leads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SCHOOL_ADMIN')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  /** Admin manually creates a lead from the dashboard. */
  @Post()
  create(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateLeadDto,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.leadsService.createPublic(tenantId, dto);
  }

  /** List all leads for the school. */
  @Get()
  findAll(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.leadsService.findAll(tenantId);
  }

  /** Get a single lead. */
  @Get(':id')
  findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.leadsService.findOne(tenantId, id);
  }

  /** Update lead status / notes. */
  @Patch(':id')
  update(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.leadsService.update(tenantId, id, dto);
  }

  /** Delete a lead. */
  @Delete(':id')
  remove(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
    return this.leadsService.remove(tenantId, id);
  }
}
