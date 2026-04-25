import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Activity } from './activity.entity';
import { ActivityMedia } from './activity-media.entity';
import { Attendance } from '../attendance/attendance.entity';
import { CreateActivityWithMediaDto } from './dto/create-activity-with-media.dto';
import { User } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { todayIST, toISTDate } from '../utils/date.util';

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
        student_id: dto.student_id ?? null,
        user: { id: dto.created_by } as User,
      });

      const savedActivity = await manager.save(newActivity);

      // 2. Create the Child Media Records (Like a WhatsApp Gallery)
      let mediaRecords: ActivityMedia[] = [];
      if (dto.media_urls && dto.media_urls.length > 0) {
        mediaRecords = dto.media_urls.map((url, i) => {
          const media_type =
            dto.media_types?.[i] === 'video' ? 'video' : 'image';
          return manager.create(ActivityMedia, {
            tenant_id: dto.tenant_id,
            activity: savedActivity,
            media_url: url,
            media_type,
          });
        });

        await manager.save(ActivityMedia, mediaRecords);
      }

      return { ...savedActivity, media: mediaRecords };
    });

    // Fire-and-forget: only push-notify parents of PRESENT students
    if (dto.class_id) {
      this.notifyPresentParents(dto.class_id, dto.tenant_id!, dto.title)
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
          toISTDate(a.created_at),
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
      const actDate = toISTDate(a.created_at);
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
    // Ensure the activity belongs to the tenant
    const activity = await this.activityRepo.findOne({ where: { id, tenant_id: tenantId } });
    if (!activity) throw new Error('Activity not found or access denied');
    // Transaction: delete activity (media should be CASCADE)
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(Activity, { id, tenant_id: tenantId });
    });
  }

  // Update activity fields (title, description, class_id, section_id)
  async updateActivity(id: string, tenantId: string, updateDto: Partial<{ title: string; description: string; class_id: string; section_id: string }>) {
    const activity = await this.activityRepo.findOne({ where: { id, tenant_id: tenantId } });
    if (!activity) throw new Error('Activity not found or access denied');

    if (updateDto.title !== undefined) activity.title = updateDto.title;
    if (updateDto.description !== undefined) activity.description = updateDto.description;
    if (updateDto.class_id !== undefined) activity.class_id = updateDto.class_id;
    if (updateDto.section_id !== undefined) activity.section_id = updateDto.section_id;

    await this.activityRepo.save(activity);
    return activity;
  }

  async getActivityById(id: string, tenantId: string) {
    return this.activityRepo.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['media', 'assignedClass'],
    });
  }

  /**
   * Silent Notification Rule:
   * Only push-notify parents whose children are marked present/late today.
   * If attendance hasn't been marked yet, fall back to notifying the entire class.
   * Personalized: each parent gets their child's name in the notification.
   */
  private async notifyPresentParents(
    classId: string,
    tenantId: string,
    title?: string,
  ): Promise<void> {
    const today = todayIST();

    // Query today's attendance for this class, joined to enrollment + student for name
    const records = await this.attendanceRepo
      .createQueryBuilder('att')
      .innerJoin('att.enrollment', 'enrollment')
      .innerJoin('enrollment.student', 'student')
      .where('att.tenant_id = :tenantId', { tenantId })
      .andWhere('enrollment.class_id = :classId', { classId })
      .andWhere('att.date = :today', { today })
      .select([
        'att.status',
        'enrollment.student_id',
        'student.first_name',
      ])
      .getRawMany();

    // If no attendance marked yet, fall back to notifying all parents in the class
    if (records.length === 0) {
      await this.notificationsService.notifyParentsOfClass(classId, tenantId, {
        title: '📸 New from class!',
        body: title || 'New activity posted — check it out!',
      });
      return;
    }

    // Only notify parents of present / late students — personalized per child
    const presentStudents = records
      .filter((r: any) => r.att_status === 'present' || r.att_status === 'late')
      .map((r: any) => ({
        studentId: r.enrollment_student_id,
        firstName: r.student_first_name,
      }));

    // Deduplicate by studentId
    const seen = new Set<string>();
    const unique = presentStudents.filter((s) => {
      if (seen.has(s.studentId)) return false;
      seen.add(s.studentId);
      return true;
    });

    await Promise.allSettled(
      unique.map((s) =>
        this.notificationsService.notifyParentsOfStudent(s.studentId, tenantId, {
          title: `📸 New photo of ${s.firstName} in class!`,
          body: title || 'Check out the latest activity update!',
        }),
      ),
    );
  }
}
