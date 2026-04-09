import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { SectionsService } from './sections.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';

@Controller('sections')
@UseGuards(JwtAuthGuard)
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @Post()
  async create(@Body() dto: CreateSectionDto, @Req() req: Request) {
    const tenantId = (req['tenantId'] as string) || (req as any).user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    return this.sectionsService.createSection(dto, tenantId);
  }

  @Get()
  async findAll(@Query('classId') classId: string, @Req() req: Request) {
    const tenantId = (req['tenantId'] as string) || (req as any).user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    if (!classId) throw new BadRequestException('Missing classId');
    return this.sectionsService.getSectionsByClass(classId, tenantId);
  }
}
