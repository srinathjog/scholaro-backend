import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance } from './attendance.entity';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
  ) {}

  async markAttendance(
    dto: MarkAttendanceDto,
    tenantId: string,
    userId: string,
  ) {
    // Prevent duplicate attendance for same enrollment_id + date + tenant
    const exists = await this.attendanceRepository.findOne({
      where: {
        enrollment_id: dto.enrollment_id,
        date: dto.date,
        tenant_id: tenantId,
      },
    });
    if (exists)
      throw new ConflictException(
        'Attendance already marked for this enrollment and date',
      );

    const attendance = this.attendanceRepository.create({
      ...dto,
      tenant_id: tenantId,
      marked_by: userId,
    });
    return this.attendanceRepository.save(attendance);
  }

  async getAttendanceByDate(date: string, tenantId: string) {
    return this.attendanceRepository.find({
      where: { date, tenant_id: tenantId },
    });
  }

  async getAttendanceByStudent(enrollmentId: string, tenantId: string) {
    return this.attendanceRepository.find({
      where: { enrollment_id: enrollmentId, tenant_id: tenantId },
    });
  }
}
