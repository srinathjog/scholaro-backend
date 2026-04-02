import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Activity } from './activity.entity';
import { ActivityMedia } from './activity-media.entity';
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

    // Fire-and-forget push notification to all parents in this class
    if (dto.class_id) {
      this.notificationsService
        .notifyParentsOfClass(dto.class_id, dto.tenant_id, {
          title: '📸 New from class!',
          body: dto.title || 'New activity posted — check it out!',
        })
        .catch((err: any) =>
          this.logger.error(`Activity push failed: ${err.message}`),
        );
    }

    return result;
  }

  // Helper to get the "WhatsApp Feed" for a specific class
  async getFeed(tenantId: string, classId: string) {
    return this.activityRepo.find({
      where: { tenant_id: tenantId, class_id: classId },
      relations: ['media', 'assignedClass'],
      order: { created_at: 'DESC' },
    });
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
}
