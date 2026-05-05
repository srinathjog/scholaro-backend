import { Injectable, ConflictException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, DataSource } from 'typeorm';
import { Attendance } from './attendance.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { todayIST } from '../utils/date.util';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  async checkToday(classId: string, tenantId: string): Promise<{ isMarked: boolean }> {
    const today = todayIST();
    const count = await this.attendanceRepository
      .createQueryBuilder('att')
      .innerJoin('att.enrollment', 'enrollment')
      .where('att.tenant_id = :tenantId', { tenantId })
      .andWhere('enrollment.class_id = :classId', { classId })
      .andWhere('att.date = :today', { today })
      .getCount();
    return { isMarked: count > 0 };
  }

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
      .orUpdate(['status', 'marked_by', 'check_in_time'], ['enrollment_id', 'date'])
      .execute();

    // Return the saved records
    return this.attendanceRepository.find({
      where: { date, tenant_id: tenantId, enrollment_id: In(enrollmentIds) },
    });
  }

  /**
   * Save a mixed-status batch in a single upsert.
   * Used by the frontend "Save Attendance" button — 1 DB round-trip instead of N.
   */
  async saveMixed(
    records: Array<{ enrollment_id: string; date: string; status: 'present' | 'absent' | 'late' | 'leave' }>,
    tenantId: string,
    userId: string,
  ): Promise<Attendance[]> {
    if (!records.length) return [];

    const now = new Date();
    const values = records.map(({ enrollment_id, date, status }) =>
      this.attendanceRepository.create({
        enrollment_id,
        date,
        status,
        tenant_id: tenantId,
        marked_by: userId,
        check_in_time: (status === 'present' || status === 'late') ? now : undefined,
      }),
    );

    await this.attendanceRepository
      .createQueryBuilder()
      .insert()
      .values(values)
      .orUpdate(['status', 'marked_by', 'check_in_time'], ['enrollment_id', 'date'])
      .execute();

    const enrollmentIds = records.map(r => r.enrollment_id);
    const dates = [...new Set(records.map(r => r.date))];
    return this.attendanceRepository.find({
      where: { date: In(dates), tenant_id: tenantId, enrollment_id: In(enrollmentIds) },
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

    // Guard: block double checkout
    if (record.check_out_time) {
      throw new BadRequestException(
        `This student was already checked out at ${record.check_out_time.toISOString()}.`,
      );
    }

    // Guard: must be checked in
    if (record.status !== 'present' && record.status !== 'late') {
      throw new BadRequestException(
        `Cannot check out a student who is marked as "${record.status}".`,
      );
    }

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
    const today = todayIST();
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

  async getMonthlyReport(
    tenantId: string,
    classId: string,
    month: number,
    year: number,
  ): Promise<Array<{ studentName: string; totalDays: number; presentCount: number; absentCount: number; percentage: number }>> {
    if (!month || !year || month < 1 || month > 12 || year < 1900) {
      throw new BadRequestException('Month and year must be valid values');
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().slice(0, 10);

    const enrollments = await this.enrollmentRepo.find({
      where: { tenant_id: tenantId, class_id: classId },
      relations: ['student'],
    });

    if (!enrollments.length) return [];

    const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
    const attendanceRows = await this.attendanceRepository
      .createQueryBuilder('a')
      .select('a.enrollment_id', 'enrollmentId')
      .addSelect("SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END)", 'presentCount')
      .addSelect("SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END)", 'absentCount')
      .addSelect("SUM(CASE WHEN a.status = 'leave' THEN 1 ELSE 0 END)", 'leaveCount')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.enrollment_id IN (:...enrollmentIds)', { enrollmentIds })
      .andWhere('a.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('a.enrollment_id')
      .getRawMany();

    const attendanceMap = new Map(
      attendanceRows.map((row) => [
        row.enrollmentId,
        {
          presentCount: parseInt(row.presentCount, 10) || 0,
          absentCount: parseInt(row.absentCount, 10) || 0,
          leaveCount: parseInt(row.leaveCount, 10) || 0,
        },
      ]),
    );

    return enrollments.map((enrollment) => {
      const student = enrollment.student;
      const studentName = [student.first_name, student.last_name].filter(Boolean).join(' ');
      const counts = attendanceMap.get(enrollment.id) ?? { presentCount: 0, absentCount: 0, leaveCount: 0 };
      const totalDays = counts.presentCount + counts.absentCount + counts.leaveCount;
      const percentage = totalDays ? Math.round((counts.presentCount / totalDays) * 100) : 0;

      return {
        studentName,
        totalDays,
        presentCount: counts.presentCount,
        absentCount: counts.absentCount,
        percentage,
      };
    });
  }

  async broadcastArrival(
    classId: string,
    date: string,
    tenantId: string,
  ): Promise<{ notified: number }> {
    const records = await this.getAttendanceByClass(classId, date, tenantId);
    const presentRecords = records.filter((r) => r.status === 'present');
    if (!presentRecords.length) return { notified: 0 };

    // Guard: skip students who already have check_in_time stamped AND a broadcast_sent flag
    // We use a simple check: only notify if check_out_time is null (still at school)
    const eligibleRecords = presentRecords.filter((r) => !r.check_out_time);
    if (!eligibleRecords.length) return { notified: 0 };

    await Promise.allSettled(
      eligibleRecords
        .filter((r) => r.enrollment?.student)
        .map((record) => {
          const name = record.enrollment.student.first_name;
          return this.notificationsService.notifyParentsOfStudent(
            record.enrollment.student_id,
            tenantId,
            { title: '🏫 School Check-in', body: `${name} has reached school safely! 🏫` },
          );
        }),
    );

    return { notified: eligibleRecords.length };
  }

  /**
   * Bulk checkout: check out multiple students in one transaction.
   * Sets status to 'checked_out', stamps check_out_time, and notifies parents.
   */
  async bulkCheckout(
    tenantId: string,
    attendanceIds: string[],
    userId: string,
  ): Promise<{ checkedOut: number; notified: number }> {
    if (!attendanceIds.length) return { checkedOut: 0, notified: 0 };

    const records = await this.attendanceRepository.find({
      where: { id: In(attendanceIds), tenant_id: tenantId },
      relations: ['enrollment', 'enrollment.student'],
    });

    if (!records.length) throw new NotFoundException('No matching attendance records found');

    // Filter: only present/late students who haven't been checked out yet
    const eligible = records.filter(
      (r) => (r.status === 'present' || r.status === 'late') && !r.check_out_time,
    );

    if (!eligible.length) {
      throw new BadRequestException('No eligible students to check out (already checked out or absent)');
    }

    const now = new Date();

    await this.dataSource.transaction(async (manager) => {
      for (const record of eligible) {
        record.check_out_time = now;
        record.pickup_by_name = 'Parent';
        record.checkout_by = userId;
      }
      await manager.save(eligible);
    });

    // Notify parents in background
    let notified = 0;
    for (const record of eligible) {
      if (record.enrollment?.student) {
        const name = record.enrollment.student.first_name;
        this.notificationsService
          .notifyParentsOfStudent(record.enrollment.student_id, tenantId, {
            title: '\uD83D\uDC4B Pickup Complete',
            body: `${name} has been picked up by Parent.`,
          })
          .then(() => notified++)
          .catch((err: any) => this.logger.error(`Bulk checkout push failed for ${name}: ${err.message}`));
      }
    }

    return { checkedOut: eligible.length, notified };
  }
}
