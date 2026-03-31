import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Activity } from './activity.entity';
import { ActivityMedia } from './activity-media.entity';
import { CreateActivityWithMediaDto } from './dto/create-activity-with-media.dto';
import { User } from '../users/user.entity';

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
    @InjectRepository(ActivityMedia)
    private readonly activityMediaRepo: Repository<ActivityMedia>,
    private readonly dataSource: DataSource,
  ) {}

  async createActivity(dto: CreateActivityWithMediaDto) {
    // START TRANSACTION
    return await this.dataSource.transaction(async (manager) => {
      // 1. Create the Parent Activity
      const newActivity = manager.create(Activity, {
        tenant_id: dto.tenant_id,
        class_id: dto.class_id,
        section_id: dto.section_id,
        title: dto.title,
        description: dto.description,
        activity_type: dto.activity_type,
        created_by: dto.created_by,
        user: { id: dto.created_by } as User, // Set user relation for userId
      });

      const savedActivity = await manager.save(newActivity);

      // 2. Create the Child Media Records (Like a WhatsApp Gallery)
      let mediaRecords: ActivityMedia[] = [];
      if (dto.media_urls && dto.media_urls.length > 0) {
        mediaRecords = dto.media_urls.map((url) => {
          return manager.create(ActivityMedia, {
            tenant_id: dto.tenant_id,
            activity: savedActivity, // Set relation for activityId
            media_url: url,
            media_type: 'image',
          });
        });

        await manager.save(ActivityMedia, mediaRecords);
      }

      // Return the full activity with its media for the UI to show immediately
      return { ...savedActivity, media: mediaRecords };
    });
  }

  // Helper to get the "WhatsApp Feed" for a specific class
  async getFeed(tenantId: string, classId: string) {
    return this.activityRepo.find({
      where: { tenant_id: tenantId, class_id: classId },
      relations: ['media'], // This joins the photos automatically
      order: { created_at: 'DESC' },
    });
  }
}
