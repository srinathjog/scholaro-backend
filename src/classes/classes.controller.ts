import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';

@Controller('classes')
@UseGuards(JwtAuthGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  async create(@Body() dto: CreateClassDto, @Req() req: Request) {
    const tenantId = (req['tenantId'] as string) || (req as any).user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    return this.classesService.createClass(dto, tenantId);
  }

  @Get()
  async findAll(@Req() req: Request) {
    const tenantId = (req['tenantId'] as string) || (req as any).user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    return this.classesService.getAllClasses(tenantId);
  }
}
