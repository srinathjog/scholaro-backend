import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FeesService } from './fees.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { CreateFeeDto } from './dto/create-fee.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

interface UserJwt {
  userId: string;
  tenantId: string;
  role: string;
}
import type { Request } from 'express';

@Controller('fees')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SCHOOL_ADMIN')
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  // ─── Fee Structures ────────────────────────────────────────────

  @Post('structures')
  async createStructure(
    @Body() dto: CreateFeeStructureDto,
    @Req() req: Request,
  ) {
    const { tenantId } = req.user as UserJwt;
    return this.feesService.createStructure(dto, tenantId);
  }

  @Get('structures')
  async getStructures(
    @Query('academic_year_id') academicYearId: string,
    @Req() req: Request,
  ) {
    const { tenantId } = req.user as UserJwt;
    return this.feesService.getStructures(tenantId, academicYearId);
  }

  // ─── Invoice Generation ────────────────────────────────────────

  @Post('generate/:classId')
  async generateMonthlyInvoices(
    @Param('classId') classId: string,
    @Body() body: { month: string },
    @Req() req: Request,
  ) {
    const { tenantId } = req.user as UserJwt;
    return this.feesService.generateMonthlyInvoices(tenantId, classId, body.month);
  }

  // ─── Individual Fee ────────────────────────────────────────────

  @Post()
  async createFee(@Body() dto: CreateFeeDto, @Req() req: Request) {
    const { tenantId, userId } = req.user as UserJwt;
    return this.feesService.createFee(dto, tenantId, userId);
  }

  // ─── Payments ──────────────────────────────────────────────────

  @Patch(':id/pay')
  async recordPayment(
    @Param('id') feeId: string,
    @Body() dto: RecordPaymentDto,
    @Req() req: Request,
  ) {
    const { tenantId } = req.user as UserJwt;
    return this.feesService.recordPayment(tenantId, feeId, dto);
  }

  // ─── Discounts ─────────────────────────────────────────────────

  @Patch(':id/discount')
  async applyDiscount(
    @Param('id') feeId: string,
    @Body() body: { discount_amount: number; reason: string },
    @Req() req: Request,
  ) {
    const { tenantId } = req.user as UserJwt;
    return this.feesService.applyDiscount(
      tenantId,
      feeId,
      body.discount_amount,
      body.reason,
    );
  }

  // ─── Queries ───────────────────────────────────────────────────

  @Get('enrollment/:enrollmentId')
  async getFeesByEnrollment(
    @Param('enrollmentId') enrollmentId: string,
    @Req() req: Request,
  ) {
    const { tenantId } = req.user as UserJwt;
    return this.feesService.getFeesByEnrollment(tenantId, enrollmentId);
  }

  @Get('defaulters/:classId')
  async getDefaultersList(
    @Param('classId') classId: string,
    @Req() req: Request,
  ) {
    const { tenantId } = req.user as UserJwt;
    return this.feesService.getDefaultersList(tenantId, classId);
  }

  @Get('summary/:classId')
  async getClassFeeSummary(
    @Param('classId') classId: string,
    @Req() req: Request,
  ) {
    const { tenantId } = req.user as UserJwt;
    return this.feesService.getClassFeeSummary(tenantId, classId);
  }

  // ─── Overdue batch ─────────────────────────────────────────────

  @Post('mark-overdue')
  async markOverdue(@Req() req: Request) {
    const { tenantId } = req.user as UserJwt;
    const count = await this.feesService.markOverdueFees(tenantId);
    return { marked_overdue: count };
  }

  // ─── Fee Reminder ──────────────────────────────────────────────

  @Post('remind/:feeId')
  async sendReminder(
    @Param('feeId') feeId: string,
    @Req() req: Request,
  ) {
    const { tenantId } = req.user as UserJwt;
    return this.feesService.sendReminder(tenantId, feeId);
  }
}
