import {
  Controller,
  Get,
  Req,
  Param,
  UseGuards,
  BadRequestException,
  Post,
  Body,
} from '@nestjs/common';
import { ParentsService } from './parents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { Request } from 'express';
import { LinkParentStudentDto } from './dto/link-parent-student.dto';

interface UserJwt {
  userId: string;
  tenantId: string;
  role: string;
}

@Controller('parents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PARENT')
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Get('me/students')
  async getMyStudents(@Req() req: Request) {
    const user = req.user as UserJwt;
    if (!user?.userId || !user?.tenantId)
      throw new BadRequestException('Invalid user');
    return this.parentsService.getMyStudents(user.userId, user.tenantId);
  }

  @Get('student/:studentId/attendance')
  async getStudentAttendance(
    @Req() req: Request,
    @Param('studentId') studentId: string,
  ) {
    const user = req.user as UserJwt;
    if (!user?.userId || !user?.tenantId)
      throw new BadRequestException('Invalid user');
    return this.parentsService.getStudentAttendance(
      studentId,
      user.userId,
      user.tenantId,
    );
  }

  @Post('link')
  async linkParentToStudent(
    @Body() dto: LinkParentStudentDto,
    @Req() req: Request,
  ) {
    const user = req.user as UserJwt;
    if (!user?.tenantId) throw new BadRequestException('Invalid user');
    return this.parentsService.linkParentToStudent(dto, user.tenantId);
  }

  @Post()
  async createParent(
    @Body() dto: { name: string; email: string; password: string },
    @Req() req: Request,
  ) {
    const user = req.user as UserJwt;
    if (!user?.tenantId) throw new BadRequestException('Invalid user');
    // Call a service method to create user, assign PARENT role, and (optionally) create parent profile
    return this.parentsService.createParent(dto, user.tenantId);
  }
}
