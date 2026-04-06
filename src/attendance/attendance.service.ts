import { Injectable, ConflictException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Attendance } from './attendance.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async markAttendance(
    dto: MarkAttendanceDto,
    tenantId: string,
    userId: string,
  ) {
    // Upsert: update if already exists, create if not
    const exists = await this.attendanceRepository.findOne({
      where: {
        enrollment_id: dto.enrollment_id,
        date: dto.date,
        tenant_id: tenantId,
      },
    });
    if (exists) {
      exists.status = dto.status;
      exists.marked_by = userId;
      if (dto.status === 'present' || dto.status === 'late') {
        exists.check_in_time = exists.check_in_time || new Date();
      }
      return this.attendanceRepository.save(exists);
    }

    const attendance = this.attendanceRepository.create({
      ...dto,
      tenant_id: tenantId,
      marked_by: userId,
      check_in_time: (dto.status === 'present' || dto.status === 'late') ? new Date() : undefined,
    });
    return this.attendanceRepository.save(attendance);
  }

  async markBulk(
    enrollmentIds: string[],
    date: string,
    status: 'present' | 'absent' | 'late' | 'leave',
    tenantId: string,
    userId: string,
  ): Promise<Attendance[]> {
    if (!enrollmentIds.length) return [];

    const checkInTime = (status === 'present' || status === 'late') ? new Date() : undefined;

    const values = enrollmentIds.map((eid) =>
      this.attendanceRepository.create({
        enrollment_id: eid,
        date,
        status,
        tenant_id: tenantId,
        marked_by: userId,
        check_in_time: checkInTime,
      }),
    );

    // Bulk upsert: insert or update status + marked_by on conflict
    await this.attendanceRepository
      .createQueryBuilder()
      .insert()
      .values(values)
      .orUpdate(['status', 'marked_by', 'check_in_time'], ['enrollment_id', 'date', 'tenant_id'])
      .execute();

    // Return the saved records
    return this.attendanceRepository.find({
      where: { date, tenant_id: tenantId, enrollment_id: In(enrollmentIds) },
    });
  }

  async getAttendanceByDate(date: string, tenantId: string) {
    return this.attendanceRepository.find({
      where: { date, tenant_id: tenantId },
    });
  }

  async getAttendanceByClass(classId: string, date: string, tenantId: string) {
    return this.attendanceRepository
      .createQueryBuilder('att')
      .innerJoinAndSelect('att.enrollment', 'enrollment')
      .innerJoinAndSelect('enrollment.student', 'student')
      .where('att.tenant_id = :tenantId', { tenantId })
      .andWhere('enrollment.class_id = :classId', { classId })
      .andWhere('att.date = :date', { date })
      .orderBy('student.first_name', 'ASC')
      .getMany();
  }

  async getAttendanceByStudent(enrollmentId: string, tenantId: string) {
    return this.attendanceRepository.find({
      where: { enrollment_id: enrollmentId, tenant_id: tenantId },
    });
  }

  async checkoutStudent(
    attendanceId: string,
    tenantId: string,
    userId: string,
    pickupByName: string,
    pickupByPhotoUrl?: string,
    pickupNotes?: string,
  ): Promise<Attendance> {
    const record = await this.attendanceRepository.findOne({
      where: { id: attendanceId, tenant_id: tenantId },
      relations: ['enrollment', 'enrollment.student'],
    });
    if (!record) throw new NotFoundException('Attendance record not found');

    record.check_out_time = new Date();
    record.pickup_by_name = pickupByName;
    record.pickup_by_photo_url = pickupByPhotoUrl;
    record.pickup_notes = pickupNotes;
    record.checkout_by = userId;
    const saved = await this.attendanceRepository.save(record);

    // Notify parent: "Aarav has been picked up by Dad"
    if (record.enrollment?.student) {
      const name = record.enrollment.student.first_name;
      this.notificationsService
        .notifyParentsOfStudent(record.enrollment.student_id, tenantId, {
          title: '🏠 Pickup Complete',
          body: `${name} has been picked up by ${pickupByName}.`,
        })
        .catch((err: any) => this.logger.error(`Checkout push failed: ${err.message}`));
    }

    return saved;
  }

  // ─── FAST-CHECK METHODS ───

  /**
   * One-tap: mark an entire list of students as Present for today.
   * Auto-stamps check_in_time.
   */
  async bulkMarkPresent(
    tenantId: string,
    enrollmentIds: string[],
    userId: string,
  ): Promise<Attendance[]> {
    const today = new Date().toISOString().slice(0, 10);
    return this.markBulk(enrollmentIds, today, 'present', tenantId, userId);
  }

  /**
   * Secure checkout: log who picked up the child.
   * CRITICAL: Only students with status present/late AND no existing check_out_time can be checked out.
   */
  async secureCheckout(
    tenantId: string,
    attendanceId: string,
    data: { pickup_by_name: string; pickup_by_photo_url?: string; pickup_notes?: string },
    userId: string,
  ): Promise<Attendance> {
    const record = await this.attendanceRepository.findOne({
      where: { id: attendanceId, tenant_id: tenantId },
      relations: ['enrollment', 'enrollment.student'],
    });
    if (!record) throw new NotFoundException('Attendance record not found');

    // Guard: must be checked in
    if (record.status !== 'present' && record.status !== 'late') {
      throw new BadRequestException(
        `Cannot check out a student who is marked as "${record.status}". Only checked-in students (present/late) can be released.`,
      );
    }

    // Guard: must not already be checked out
    if (record.check_out_time) {
      throw new BadRequestException(
        `This student was already checked out at ${record.check_out_time.toISOString()}.`,
      );
    }

    record.check_out_time = new Date();
    record.pickup_by_name = data.pickup_by_name;
    record.pickup_by_photo_url = data.pickup_by_photo_url;
    record.pickup_notes = data.pickup_notes;
    record.checkout_by = userId;
    const saved = await this.attendanceRepository.save(record);

    // Push notification to parent
    if (record.enrollment?.student) {
      const name = record.enrollment.student.first_name;
      this.notificationsService
        .notifyParentsOfStudent(record.enrollment.student_id, tenantId, {
          title: '\uD83C\uDFE0 Pickup Complete',
          body: `${name} has been picked up by ${data.pickup_by_name}.`,
        })
        .catch((err: any) => this.logger.error(`Checkout push failed: ${err.message}`));
    }

    return saved;
  }

  /**
   * Daily report: returns categorized lists of students for a class on a date.
   * present  = checked in, NOT yet checked out
   * absent   = marked absent / leave, or not marked at all
   * checkedOut = checked in AND already picked up
   */
  async getDailyReport(
    tenantId: string,
    classId: string,
    date: string,
  ): Promise<{
    date: string;
    summary: { present: number; absent: number; late: number; leave: number; checkedOut: number; total: number };
    present: Attendance[];
    absent: Attendance[];
    checkedOut: Attendance[];
  }> {
    const records = await this.getAttendanceByClass(classId, date, tenantId);

    const present: Attendance[] = [];
    const absent: Attendance[] = [];
    const checkedOut: Attendance[] = [];
    let lateCount = 0;
    let leaveCount = 0;

    for (const r of records) {
      if (r.check_out_time) {
        checkedOut.push(r);
      } else if (r.status === 'present' || r.status === 'late') {
        present.push(r);
      } else {
        absent.push(r);
      }
      if (r.status === 'late') lateCount++;
      if (r.status === 'leave') leaveCount++;
    }

    return {
      date,
      summary: {
        present: present.length,
        absent: absent.length,
        late: lateCount,
        leave: leaveCount,
        checkedOut: checkedOut.length,
        total: records.length,
      },
      present,
      absent,
      checkedOut,
    };
  }

  async broadcastArrival(
    classId: string,
    date: string,
    tenantId: string,
  ): Promise<{ notified: number }> {
    const records = await this.getAttendanceByClass(classId, date, tenantId);
    const presentRecords = records.filter((r) => r.status === 'present');
    if (!presentRecords.length) return { notified: 0 };

    await Promise.allSettled(
      presentRecords
        .filter((r) => r.enrollment?.student)
        .map((record) => {
          const name = record.enrollment.student.first_name;
          return this.notificationsService.notifyParentsOfStudent(
            record.enrollment.student_id,
            tenantId,
            { title: '🏫 Arrived Safely!', body: `${name} has arrived safely at school!` },
          );
        }),
    );

    return { notified: presentRecords.length };
  }
}
