import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DailyLog } from './daily-log.entity';
import { CreateDailyLogDto } from './dto/create-daily-log.dto';
import { Enrollment } from '../enrollments/enrollment.entity';

@Injectable()
export class DailyLogsService {
  constructor(
    @InjectRepository(DailyLog)
    private readonly dailyLogRepo: Repository<DailyLog>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateDailyLogDto): Promise<DailyLog> {
    // Always filter by tenant_id
    const log = this.dailyLogRepo.create({ ...dto });
    return await this.dailyLogRepo.save(log);
  }

  async findByStudentAndDate(
    tenantId: string,
    enrollmentId: string,
    date: string,
  ): Promise<DailyLog[]> {
    // date: YYYY-MM-DD
    return this.dailyLogRepo
      .createQueryBuilder('log')
      .where('log.tenant_id = :tenantId', { tenantId })
      .andWhere('log.enrollment_id = :enrollmentId', { enrollmentId })
      .andWhere('DATE(log.created_at) = :date', { date })
      .orderBy('log.created_at', 'ASC')
      .getMany();
  }

  async getClassSummary(
    tenantId: string,
    classId: string,
    date: string,
  ): Promise<any[]> {
    // Complex query: all logs for all students in a class for a given day
    return this.dailyLogRepo
      .createQueryBuilder('log')
      .innerJoin('log.enrollment', 'enrollment')
      .where('log.tenant_id = :tenantId', { tenantId })
      .andWhere('enrollment.class_id = :classId', { classId })
      .andWhere('DATE(log.created_at) = :date', { date })
      .select([
        'log.id',
        'log.enrollment_id',
        'log.category',
        'log.log_value',
        'log.notes',
        'log.logged_by',
        'log.created_at',
        'enrollment.student_id',
      ])
      .getRawMany();
  }
}
