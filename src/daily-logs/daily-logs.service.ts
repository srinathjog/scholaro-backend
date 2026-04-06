import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DailyLog } from './daily-log.entity';
import { CreateDailyLogDto } from './dto/create-daily-log.dto';
import { Enrollment } from '../enrollments/enrollment.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DailyLogsService {
  private readonly logger = new Logger(DailyLogsService.name);

  constructor(
    @InjectRepository(DailyLog)
    private readonly dailyLogRepo: Repository<DailyLog>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  private readonly categoryEmoji: Record<string, string> = {
    meal: '🍲', nap: '😴', potty: '🚽', mood: '😊', health: '💪',
  };

  async create(dto: CreateDailyLogDto): Promise<DailyLog> {
    // Always filter by tenant_id
    const log = this.dailyLogRepo.create({ ...dto });
    const saved = await this.dailyLogRepo.save(log);

    // Fire-and-forget push notification to parents
    this.sendLogNotification(dto).catch((err) =>
      this.logger.error(`Push notification failed: ${err.message}`),
    );

    return saved;
  }

  private async sendLogNotification(dto: CreateDailyLogDto): Promise<void> {
    const enrollment = await this.enrollmentRepo.findOne({
      where: { id: dto.enrollment_id },
      relations: ['student'],
    });
    if (!enrollment?.student) return;

    const name = enrollment.student.first_name;
    const emoji = this.categoryEmoji[dto.category] || '📝';
    const value = dto.log_value.replace(/_/g, ' ');

    const sentences: Record<string, Record<string, string>> = {
      meal: { finished: 'finished the entire meal!', half: 'ate half the meal.', not_eaten: "didn't eat today.", skipped: 'skipped the meal.' },
      nap: { slept_well: 'slept really well!', '1hr_plus': 'napped for over an hour!', short_nap: 'had a short nap.', no_nap: "didn't nap today.", sleeping: 'is sleeping peacefully.' },
      mood: { happy: 'is having a great time! 🎉', playful: 'is feeling super playful!', fussy: 'was a little fussy.', quiet: 'was quiet today.', cranky: 'was a bit cranky.' },
      potty: { dry: 'stayed dry — great job!', normal: 'had a normal potty break.', wet: 'had a wet diaper.', changed: 'was changed.' },
      health: { fine: 'is feeling healthy!', mild_fever: 'has a mild fever.', sick: 'is feeling under the weather.' },
    };

    const sentence = sentences[dto.category]?.[dto.log_value] || `— ${value}`;

    await this.notificationsService.notifyParentsOfStudent(
      enrollment.student_id,
      dto.tenant_id,
      {
        title: `${emoji} ${dto.category.charAt(0).toUpperCase() + dto.category.slice(1)} Update`,
        body: `${name} ${sentence}`,
      },
    );
  }

  async findByStudentAndDate(
    tenantId: string,
    enrollmentId: string,
    date: string,
  ): Promise<DailyLog[]> {
    // date: YYYY-MM-DD — use range query instead of DATE() to allow index usage
    return this.dailyLogRepo
      .createQueryBuilder('log')
      .where('log.tenant_id = :tenantId', { tenantId })
      .andWhere('log.enrollment_id = :enrollmentId', { enrollmentId })
      .andWhere('log.created_at >= :dateStart', { dateStart: `${date}T00:00:00` })
      .andWhere('log.created_at < :dateEnd', { dateEnd: this.nextDay(date) })
      .orderBy('log.created_at', 'ASC')
      .getMany();
  }

  async getClassSummary(
    tenantId: string,
    classId: string,
    date: string,
  ): Promise<DailyLog[]> {
    return this.dailyLogRepo
      .createQueryBuilder('log')
      .innerJoinAndSelect('log.enrollment', 'enrollment')
      .innerJoinAndSelect('enrollment.student', 'student')
      .where('log.tenant_id = :tenantId', { tenantId })
      .andWhere('enrollment.class_id = :classId', { classId })
      .andWhere('log.created_at >= :dateStart', { dateStart: `${date}T00:00:00` })
      .andWhere('log.created_at < :dateEnd', { dateEnd: this.nextDay(date) })
      .orderBy('student.first_name', 'ASC')
      .addOrderBy('log.created_at', 'ASC')
      .getMany();
  }

  /** Return YYYY-MM-DDT00:00:00 for the day after the given date string */
  private nextDay(date: string): string {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10) + 'T00:00:00';
  }
}
