import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Fee, FeeStructure } from './fee.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { CreateFeeDto } from './dto/create-fee.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FeesService {
  private readonly logger = new Logger(FeesService.name);

  constructor(
    @InjectRepository(Fee)
    private readonly feeRepo: Repository<Fee>,
    @InjectRepository(FeeStructure)
    private readonly structureRepo: Repository<FeeStructure>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Fee Structures (templates) ────────────────────────────────

  async createStructure(
    dto: CreateFeeStructureDto,
    tenantId: string,
  ): Promise<FeeStructure & { invoices_created: number }> {
    const structure = this.structureRepo.create({
      ...dto,
      amount: dto.amount,
      tenant_id: tenantId,
    });
    const saved = await this.structureRepo.save(structure);

    // Auto-generate fee invoices for all active enrollments in this class
    const enrollments = await this.enrollmentRepo.find({
      where: { tenant_id: tenantId, class_id: dto.class_id, status: 'active' },
    });

    let invoicesCreated = 0;
    if (enrollments.length > 0) {
      const structureAmount = Number(saved.amount);
      const dueDates = this.getInvoiceDueDates(saved.frequency, saved.due_date);
      const fees: Fee[] = [];

      for (const enrollment of enrollments) {
        // Use custom fee if set on enrollment, otherwise use structure amount
        const totalAmount = enrollment.custom_fee_amount
          ? Number(enrollment.custom_fee_amount)
          : structureAmount;

        for (const dueDate of dueDates) {
          fees.push(
            this.feeRepo.create({
              tenant_id: tenantId,
              enrollment_id: enrollment.id,
              fee_structure_id: saved.id,
              description: dueDates.length > 1
                ? `${saved.name} (due ${dueDate})`
                : saved.name,
              total_amount: totalAmount,
              discount_amount: 0,
              final_amount: totalAmount,
              paid_amount: 0,
              due_date: dueDate,
              status: 'pending',
            }),
          );
        }
      }

      await this.feeRepo.save(fees);
      invoicesCreated = fees.length;
      this.logger.log(
        `Auto-generated ${invoicesCreated} invoices for structure "${saved.name}" (class ${dto.class_id})`,
      );
    }

    return { ...saved, invoices_created: invoicesCreated };
  }

  async getStructures(
    tenantId: string,
    academicYearId?: string,
  ): Promise<FeeStructure[]> {
    const where: any = { tenant_id: tenantId };
    if (academicYearId) where.academic_year_id = academicYearId;
    return this.structureRepo.find({ where, order: { due_date: 'ASC' } });
  }

  async deleteStructure(
    tenantId: string,
    structureId: string,
  ): Promise<{ deleted: boolean }> {
    const structure = await this.structureRepo.findOne({
      where: { id: structureId, tenant_id: tenantId },
    });
    if (!structure) {
      throw new NotFoundException('Fee structure not found.');
    }

    // Check if any fees reference this structure
    const feeCount = await this.feeRepo.count({
      where: { fee_structure_id: structureId, tenant_id: tenantId },
    });
    if (feeCount > 0) {
      throw new BadRequestException(
        `Cannot delete: ${feeCount} fee invoice(s) reference this structure.`,
      );
    }

    await this.structureRepo.remove(structure);
    return { deleted: true };
  }

  // ─── Generate Monthly Invoices ─────────────────────────────────

  /**
   * Auto-create Fee records for every active enrollment in a class
   * based on assigned FeeStructures for the given month.
   *
   * `month` is YYYY-MM (e.g. "2026-04"). We match FeeStructures
   * whose due_date falls within that month.
   */
  async generateMonthlyInvoices(
    tenantId: string,
    classId: string,
    month: string, // YYYY-MM
  ): Promise<{ created: number; skipped: number; fees: Fee[] }> {
    // 1. Find all active enrollments in this class for this tenant
    const enrollments = await this.enrollmentRepo.find({
      where: { tenant_id: tenantId, class_id: classId, status: 'active' },
    });

    if (enrollments.length === 0) {
      return { created: 0, skipped: 0, fees: [] };
    }

    // 2. Find fee structures whose due_date falls in this month
    const monthStart = `${month}-01`;
    const monthEnd = this.lastDayOfMonth(month);

    const structures = await this.structureRepo
      .createQueryBuilder('fs')
      .where('fs.tenant_id = :tenantId', { tenantId })
      .andWhere('fs.class_id = :classId', { classId })
      .andWhere('fs.due_date >= :monthStart', { monthStart })
      .andWhere('fs.due_date <= :monthEnd', { monthEnd })
      .getMany();

    if (structures.length === 0) {
      return { created: 0, skipped: 0, fees: [] };
    }

    // 3. Get existing fees for these enrollments + structures to avoid duplicates
    const enrollmentIds = enrollments.map((e) => e.id);
    const structureIds = structures.map((s) => s.id);

    const existingFees = await this.feeRepo
      .createQueryBuilder('f')
      .where('f.tenant_id = :tenantId', { tenantId })
      .andWhere('f.enrollment_id IN (:...enrollmentIds)', { enrollmentIds })
      .andWhere('f.fee_structure_id IN (:...structureIds)', { structureIds })
      .getMany();

    const existingSet = new Set(
      existingFees.map((f) => `${f.enrollment_id}::${f.fee_structure_id}`),
    );

    // 4. Generate fee records
    const created: Fee[] = [];
    let skipped = 0;

    for (const enrollment of enrollments) {
      for (const structure of structures) {
        const key = `${enrollment.id}::${structure.id}`;
        if (existingSet.has(key)) {
          skipped++;
          continue;
        }

        const totalAmount = Number(structure.amount);
        const fee = this.feeRepo.create({
          tenant_id: tenantId,
          enrollment_id: enrollment.id,
          fee_structure_id: structure.id,
          description: structure.name,
          total_amount: totalAmount,
          discount_amount: 0,
          final_amount: totalAmount,
          paid_amount: 0,
          due_date: structure.due_date,
          status: 'pending',
        });
        created.push(fee);
      }
    }

    const saved = created.length > 0 ? await this.feeRepo.save(created) : [];

    this.logger.log(
      `Generated ${saved.length} invoices for class ${classId}, month ${month} (${skipped} skipped)`,
    );

    return { created: saved.length, skipped, fees: saved };
  }

  // ─── Create Individual Fee (manual) ────────────────────────────

  async createFee(
    dto: CreateFeeDto,
    tenantId: string,
    userId: string,
  ): Promise<Fee> {
    const total = dto.total_amount;
    const discount = dto.discount_amount ?? 0;
    const final_amount = total - discount;

    if (final_amount < 0) {
      throw new BadRequestException('Discount cannot exceed total amount.');
    }

    const fee = this.feeRepo.create({
      tenant_id: tenantId,
      enrollment_id: dto.enrollment_id,
      fee_structure_id: dto.fee_structure_id,
      description: dto.description,
      total_amount: total,
      discount_amount: discount,
      discount_reason: dto.discount_reason,
      final_amount,
      paid_amount: 0,
      due_date: dto.due_date,
      status: 'pending',
      created_by: userId,
    });

    return this.feeRepo.save(fee);
  }

  // ─── Record Payment (supports partial) ─────────────────────────

  /**
   * Record a payment against a fee invoice.
   * Handles partial payments: updates paid_amount and transitions status.
   *
   * pending → partially_paid → paid
   */
  async recordPayment(
    tenantId: string,
    feeId: string,
    dto: RecordPaymentDto,
  ): Promise<Fee> {
    const fee = await this.feeRepo.findOne({
      where: { id: feeId, tenant_id: tenantId },
      relations: ['enrollment', 'enrollment.student'],
    });

    if (!fee) {
      throw new NotFoundException('Fee record not found.');
    }

    if (fee.status === 'paid') {
      throw new BadRequestException('This fee has already been fully paid.');
    }

    const paymentAmount = dto.amount;
    if (paymentAmount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero.');
    }

    const newPaid = Number(fee.paid_amount) + paymentAmount;
    const finalAmount = Number(fee.final_amount);

    if (newPaid > finalAmount) {
      throw new BadRequestException(
        `Payment of ₹${paymentAmount} exceeds the remaining balance of ₹${(finalAmount - Number(fee.paid_amount)).toFixed(2)}.`,
      );
    }

    fee.paid_amount = newPaid;

    if (newPaid >= finalAmount) {
      fee.status = 'paid';
    } else {
      fee.status = 'partially_paid';
    }

    const saved = await this.feeRepo.save(fee);

    this.logger.log(
      `Payment ₹${paymentAmount} recorded for fee ${feeId}. Status: ${saved.status}`,
    );

    return saved;
  }

  // ─── Apply Discount ────────────────────────────────────────────

  async applyDiscount(
    tenantId: string,
    feeId: string,
    discountAmount: number,
    reason: string,
  ): Promise<Fee> {
    const fee = await this.feeRepo.findOne({
      where: { id: feeId, tenant_id: tenantId },
    });

    if (!fee) throw new NotFoundException('Fee record not found.');

    if (fee.status === 'paid') {
      throw new BadRequestException('Cannot apply discount to a fully paid fee.');
    }

    const totalAmount = Number(fee.total_amount);
    if (discountAmount > totalAmount) {
      throw new BadRequestException('Discount cannot exceed the total amount.');
    }

    fee.discount_amount = discountAmount;
    fee.discount_reason = reason;
    fee.final_amount = totalAmount - discountAmount;

    // Re-evaluate status based on new final_amount
    const paid = Number(fee.paid_amount);
    if (paid >= fee.final_amount) {
      fee.status = 'paid';
    } else if (paid > 0) {
      fee.status = 'partially_paid';
    }

    return this.feeRepo.save(fee);
  }

  // ─── Defaulters List ───────────────────────────────────────────

  /**
   * Get all students with pending or overdue fees for a given class.
   * Returns enrollment + student info with their outstanding fees.
   */
  async getDefaultersList(
    tenantId: string,
    classId: string,
  ): Promise<{
    total_outstanding: number;
    count: number;
    defaulters: {
      enrollment_id: string;
      student_name: string;
      roll_number: string;
      fees: Fee[];
      total_due: number;
    }[];
  }> {
    const fees = await this.feeRepo
      .createQueryBuilder('fee')
      .innerJoinAndSelect('fee.enrollment', 'enrollment')
      .innerJoinAndSelect('enrollment.student', 'student')
      .where('fee.tenant_id = :tenantId', { tenantId })
      .andWhere('enrollment.class_id = :classId', { classId })
      .andWhere('fee.status IN (:...statuses)', {
        statuses: ['pending', 'overdue', 'partially_paid'],
      })
      .orderBy('student.first_name', 'ASC')
      .addOrderBy('fee.due_date', 'ASC')
      .getMany();

    // Group by enrollment
    const grouped = new Map<
      string,
      { enrollment_id: string; student_name: string; roll_number: string; fees: Fee[]; total_due: number }
    >();

    for (const fee of fees) {
      const eid = fee.enrollment_id;
      if (!grouped.has(eid)) {
        const student = fee.enrollment?.student;
        grouped.set(eid, {
          enrollment_id: eid,
          student_name: student
            ? `${student.first_name} ${student.last_name}`
            : 'Unknown',
          roll_number: fee.enrollment?.roll_number || '',
          fees: [],
          total_due: 0,
        });
      }
      const entry = grouped.get(eid)!;
      entry.fees.push(fee);
      entry.total_due += Number(fee.final_amount) - Number(fee.paid_amount);
    }

    const defaulters = Array.from(grouped.values());
    const total_outstanding = defaulters.reduce((sum, d) => sum + d.total_due, 0);

    return {
      total_outstanding,
      count: defaulters.length,
      defaulters,
    };
  }

  // ─── Get Fees for Enrollment ───────────────────────────────────

  async getFeesByEnrollment(
    tenantId: string,
    enrollmentId: string,
  ): Promise<Fee[]> {
    return this.feeRepo.find({
      where: { tenant_id: tenantId, enrollment_id: enrollmentId },
      relations: ['feeStructure'],
      order: { due_date: 'ASC' },
    });
  }

  // ─── Fee Summary for Class ────────────────────────────────────

  async getClassFeeSummary(
    tenantId: string,
    classId: string,
  ): Promise<{
    total_billed: number;
    total_collected: number;
    total_outstanding: number;
    total_discount: number;
    by_status: Record<string, number>;
  }> {
    const fees = await this.feeRepo
      .createQueryBuilder('fee')
      .innerJoin('fee.enrollment', 'enrollment')
      .where('fee.tenant_id = :tenantId', { tenantId })
      .andWhere('enrollment.class_id = :classId', { classId })
      .getMany();

    let total_billed = 0;
    let total_collected = 0;
    let total_discount = 0;
    const by_status: Record<string, number> = {
      pending: 0,
      partially_paid: 0,
      paid: 0,
      overdue: 0,
    };

    for (const fee of fees) {
      total_billed += Number(fee.total_amount);
      total_collected += Number(fee.paid_amount);
      total_discount += Number(fee.discount_amount);
      by_status[fee.status] = (by_status[fee.status] || 0) + 1;
    }

    return {
      total_billed,
      total_collected,
      total_outstanding: total_billed - total_discount - total_collected,
      total_discount,
      by_status,
    };
  }

  // ─── Mark Overdue Fees ─────────────────────────────────────────

  /**
   * Batch-update all 'pending' fees past their due_date to 'overdue'.
   * Intended to be called by a daily cron or manually by admin.
   */
  async markOverdueFees(tenantId: string): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);

    const result = await this.feeRepo
      .createQueryBuilder()
      .update(Fee)
      .set({ status: 'overdue' })
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere('status = :status', { status: 'pending' })
      .andWhere('due_date < :today', { today })
      .execute();

    const affected = result.affected || 0;
    if (affected > 0) {
      this.logger.log(`Marked ${affected} fees as overdue for tenant ${tenantId}`);
    }
    return affected;
  }

  // ─── Helpers ───────────────────────────────────────────────────

  private lastDayOfMonth(yearMonth: string): string {
    const [year, month] = yearMonth.split('-').map(Number);
    // Day 0 of next month = last day of current month
    const lastDay = new Date(year, month, 0).getDate();
    return `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
  }

  /**
   * Return the list of invoice due dates based on frequency.
   * - one_time / monthly / yearly → single date (the structure's due_date)
   * - quarterly → 4 dates, 3 months apart starting from due_date
   * - half_yearly → 2 dates, 6 months apart starting from due_date
   */
  private getInvoiceDueDates(
    frequency: string,
    baseDueDate: string,
  ): string[] {
    if (frequency === 'half_yearly') {
      const base = new Date(baseDueDate);
      const d1 = baseDueDate;
      const second = new Date(base);
      second.setMonth(second.getMonth() + 6);
      const d2 = second.toISOString().slice(0, 10);
      return [d1, d2];
    }
    // For all other frequencies, single invoice with the original due date
    return [baseDueDate];
  }

  // ─── Send Fee Reminder ─────────────────────────────────────────

  /**
   * Send a fee payment reminder to the parent(s) of the student
   * linked to this fee. Logs a 'Reminder Sent' timestamp on the fee record.
   */
  async sendReminder(
    tenantId: string,
    feeId: string,
  ): Promise<{ reminded: boolean; student_name: string; last_reminder_sent: Date }> {
    const fee = await this.feeRepo.findOne({
      where: { id: feeId, tenant_id: tenantId },
      relations: ['enrollment', 'enrollment.student'],
    });

    if (!fee) throw new NotFoundException('Fee record not found.');

    if (fee.status === 'paid') {
      throw new BadRequestException('This fee is already paid. No reminder needed.');
    }

    const student = fee.enrollment?.student;
    const studentName = student
      ? `${student.first_name} ${student.last_name}`
      : 'Your child';

    const remaining = Number(fee.final_amount) - Number(fee.paid_amount);

    // Stamp the reminder timestamp
    fee.last_reminder_sent = new Date();
    await this.feeRepo.save(fee);

    // Send push notification to parent(s)
    if (student?.id) {
      this.notificationsService
        .notifyParentsOfStudent(student.id, tenantId, {
          title: '📋 Fee Reminder',
          body: `₹${remaining.toLocaleString('en-IN')} is pending for ${fee.description}. Due: ${fee.due_date}.`,
          url: '/parent/fees',
        })
        .catch((err: any) =>
          this.logger.error(`Fee reminder push failed: ${err.message}`),
        );
    }

    this.logger.log(
      `Fee reminder sent for ${studentName} — ₹${remaining} pending (fee ${feeId})`,
    );

    return {
      reminded: true,
      student_name: studentName,
      last_reminder_sent: fee.last_reminder_sent,
    };
  }
}
