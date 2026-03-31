import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { CreateActivityWithMediaDto } from './dto/create-activity-with-media.dto';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  async create(@Body() dto: CreateActivityWithMediaDto) {
    return this.activitiesService.createActivity(dto);
  }

  @Get('feed')
  async getFeed(
    @Query('tenant_id') tenantId: string,
    @Query('class_id') classId: string,
  ) {
    return this.activitiesService.getFeed(tenantId, classId);
  }
}
