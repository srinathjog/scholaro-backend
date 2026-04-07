import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Activity } from './activity.entity';
import { ActivityMedia } from './activity-media.entity';
import { Attendance } from '../attendance/attendance.entity';
import { CreateActivityWithMediaDto } from './dto/create-activity-with-media.dto';
import { User } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name);

  constructor(
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
    @InjectRepository(ActivityMedia)
    private readonly activityMediaRepo: Repository<ActivityMedia>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createActivity(dto: CreateActivityWithMediaDto) {
    // START TRANSACTION
    const result = await this.dataSource.transaction(async (manager) => {
      // 1. Create the Parent Activity
      const newActivity = manager.create(Activity, {
        tenant_id: dto.tenant_id,
        class_id: dto.class_id,
        section_id: dto.section_id,
        title: dto.title,
        description: dto.description,
        activity_type: dto.activity_type,
        created_by: dto.created_by,
        user: { id: dto.created_by } as User,
      });

      const savedActivity = await manager.save(newActivity);

      // 2. Create the Child Media Records (Like a WhatsApp Gallery)
      let mediaRecords: ActivityMedia[] = [];
      if (dto.media_urls && dto.media_urls.length > 0) {
        mediaRecords = dto.media_urls.map((url) => {
          return manager.create(ActivityMedia, {
            tenant_id: dto.tenant_id,
            activity: savedActivity,
            media_url: url,
            media_type: 'image',
          });
        });

        await manager.save(ActivityMedia, mediaRecords);
      }

      return { ...savedActivity, media: mediaRecords };
    });

    // Fire-and-forget: only push-notify parents of PRESENT students
    if (dto.class_id) {
      this.notifyPresentParents(dto.class_id, dto.tenant_id, dto.title)
        .catch((err: any) =>
          this.logger.error(`Activity push failed: ${err.message}`),
        );
    }

    return result;
  }

  // Helper to get the "WhatsApp Feed" for a specific class (paginated)
  async getFeed(
    tenantId: string,
    classId: string,
    enrollmentId?: string,
    page = 1,
    limit = 10,
  ) {
    const skip = (page - 1) * limit;

    const [activities, totalItems] = await this.activityRepo.findAndCount({
      where: { tenant_id: tenantId, class_id: classId },
      relations: ['media', 'assignedClass'],
      order: { created_at: 'DESC' },
      take: limit,
      skip,
    });

    const hasNextPage = skip + activities.length < totalItems;

    if (!enrollmentId || activities.length === 0) {
      return { data: activities, meta: { totalItems, hasNextPage, page, limit } };
    }

    // Collect unique dates from activities (YYYY-MM-DD)
    const uniqueDates = [
      ...new Set(
        activities.map((a) =>
          new Date(a.created_at).toISOString().slice(0, 10),
        ),
      ),
    ];

    // Bulk-fetch attendance records for this enrollment on those dates
    const attendanceRecords = await this.attendanceRepo.find({
      where: {
        enrollment_id: enrollmentId,
        tenant_id: tenantId,
        date: In(uniqueDates),
      },
    });

    // Build a date → is_present map
    const presentDates = new Set<string>();
    for (const rec of attendanceRecords) {
      if (rec.status === 'present' || rec.status === 'late') {
        presentDates.add(rec.date);
      }
    }

    // Enrich activities with is_present
    const data = activities.map((a) => {
      const actDate = new Date(a.created_at).toISOString().slice(0, 10);
      return { ...a, is_present: presentDates.has(actDate) };
    });

    return { data, meta: { totalItems, hasNextPage, page, limit } };
  }

  // Get all activities posted by a specific teacher (their portfolio)
  async getTeacherActivities(tenantId: string, userId: string) {
    return this.activityRepo.find({
      where: { tenant_id: tenantId, created_by: userId },
      relations: ['media', 'assignedClass'],
      order: { created_at: 'DESC' },
    });
  }

  // Delete an activity and its media (tenant-scoped)
  async deleteActivity(id: string, tenantId: string) {
    await this.activityMediaRepo.delete({ activity: { id } });
    await this.activityRepo.delete({ id, tenant_id: tenantId });
  }

  /**
   * Silent Notification Rule:
   * Only push-notify parents whose children are marked present/late today.
   * If attendance hasn't been marked yet, fall back to notifying the entire class.
   */
  private async notifyPresentParents(
    classId: string,
    tenantId: string,
    title?: string,
  ): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const payload = {
      title: '📸 New from class!',
      body: title || 'New activity posted — check it out!',
    };

    // Query today's attendance for this class, joined to enrollment for student_id
    const records = await this.attendanceRepo
      .createQueryBuilder('att')
      .innerJoin('att.enrollment', 'enrollment')
      .where('att.tenant_id = :tenantId', { tenantId })
      .andWhere('enrollment.class_id = :classId', { classId })
      .andWhere('att.date = :today', { today })
      .select(['att.status', 'enrollment.student_id'])
      .getRawMany();

    // If no attendance marked yet, fall back to notifying all parents in the class
    if (records.length === 0) {
      await this.notificationsService.notifyParentsOfClass(classId, tenantId, payload);
      return;
    }

    // Only notify parents of present / late students
    const presentStudentIds = [
      ...new Set(
        records
          .filter((r: any) => r.att_status === 'present' || r.att_status === 'late')
          .map((r: any) => r.enrollment_student_id),
      ),
    ];

    await Promise.allSettled(
      presentStudentIds.map((studentId) =>
        this.notificationsService.notifyParentsOfStudent(studentId, tenantId, payload),
      ),
    );
  }
}
