import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Activity } from './activity.entity';
import { ActivityMedia } from './activity-media.entity';
import { Attendance } from '../attendance/attendance.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
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
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createActivity(dto: CreateActivityWithMediaDto) {
    // Normalise student targeting:
    // Prefer student_ids array; fall back to wrapping legacy student_id.
    const studentIds: string[] | null =
      dto.student_ids && dto.student_ids.length > 0
        ? dto.student_ids
        : dto.student_id
          ? [dto.student_id]
          : null;

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
        // Keep legacy student_id for backward compat (first element)
        student_id: studentIds ? studentIds[0] : null,
        student_ids: studentIds,
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
    date?: string,
  ) {
    const skip = (page - 1) * limit;

    // Resolve the target date in IST. Falls back to today-in-IST if not supplied.
    const targetDate = date || todayIST(); // YYYY-MM-DD

    // Build base query
    const qb = this.activityRepo
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.media', 'media')
      .leftJoinAndSelect('activity.assignedClass', 'assignedClass')
      .where('activity.tenant_id = :tenantId', { tenantId })
      .andWhere('activity.class_id = :classId', { classId })
      // Filter by IST calendar date — converts UTC stored timestamp to IST before comparing
      .andWhere(
        `DATE(activity.created_at AT TIME ZONE 'Asia/Kolkata') = :targetDate`,
        { targetDate },
      )
      .orderBy('activity.created_at', 'DESC')
      .take(limit)
      .skip(skip);

    // When a specific child's enrollment is provided (parent feed),
    // filter so only class-wide posts OR posts targeting this child are shown.
    if (enrollmentId) {
      const enrollment = await this.enrollmentRepo.findOne({
        where: { id: enrollmentId, tenant_id: tenantId },
      });
      if (enrollment) {
        const studentId = enrollment.student_id;
        // student_ids IS NULL  → class-wide post, always visible
        // student_ids @> '["<uuid>"]'  → post targets this child
        qb.andWhere(
          `(activity.student_ids IS NULL OR activity.student_ids @> :studentArr::jsonb)`,
          { studentArr: JSON.stringify([studentId]) },
        );
      }
    }

    const [activities, totalItems] = await qb.getManyAndCount();
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
   * Principal's "God View": all activities across all classes,
   * enriched with teacher name + class name. Filterable by teacher or class.
   */
  async getAdminFeed(
    tenantId: string,
    teacherId?: string,
    classId?: string,
    page = 1,
    limit = 20,
  ) {
    const offset = (page - 1) * limit;

    const params: unknown[] = [tenantId];
    const conditions: string[] = ['a.tenant_id = $1'];

    if (teacherId) {
      params.push(teacherId);
      conditions.push(`a.created_by = $${params.length}`);
    }
    if (classId) {
      params.push(classId);
      conditions.push(`a.class_id = $${params.length}`);
    }

    const where = conditions.join(' AND ');

    params.push(limit, offset);
    const limitIdx  = params.length - 1;
    const offsetIdx = params.length;

    const rows: Array<{
      id: string;
      title: string;
      description: string | null;
      activity_type: string;
      created_at: string;
      created_by: string;
      teacher_name: string;
      class_id: string;
      class_name: string;
      media: string; // JSON string
    }> = await this.dataSource.query(
      `SELECT
         a.id,
         a.title,
         a.description,
         a.activity_type,
         a.created_at,
         a.created_by,
         COALESCE(u.name, 'Unknown') AS teacher_name,
         a.class_id,
         COALESCE(c.name, '') AS class_name,
         COALESCE(
           json_agg(
             json_build_object('id', m.id, 'media_url', m.media_url, 'media_type', m.media_type)
           ) FILTER (WHERE m.id IS NOT NULL),
           '[]'
         ) AS media
       FROM activities a
       LEFT JOIN users u ON u.id = a.created_by
       LEFT JOIN classes c ON c.id = a.class_id
       LEFT JOIN activity_media m ON m."activityId" = a.id
       WHERE ${where}
       GROUP BY a.id, u.name, c.name
       ORDER BY a.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );

    // Count total (without pagination)
    const countParams: unknown[] = [tenantId];
    const countConditions: string[] = ['a.tenant_id = $1'];
    if (teacherId) { countParams.push(teacherId); countConditions.push(`a.created_by = $${countParams.length}`); }
    if (classId)   { countParams.push(classId);   countConditions.push(`a.class_id = $${countParams.length}`); }

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM activities a WHERE ${countConditions.join(' AND ')}`,
      countParams,
    ) as [{ count: number }];

    const data = rows.map(r => ({
      ...r,
      media: typeof r.media === 'string' ? JSON.parse(r.media) : r.media,
    }));

    return {
      data,
      meta: {
        totalItems: count,
        page,
        limit,
        hasNextPage: page * limit < count,
      },
    };
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
