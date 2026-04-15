import {
  Controller,
  Get,
  Req,
  Param,
  Query,
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
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  // ── Admin endpoints (SCHOOL_ADMIN) ──

  @Get('admin/list')
  @Roles('SCHOOL_ADMIN')
  async listAllParents(
    @Req() req: Request,
    @Query('search') search?: string,
  ) {
    const user = req.user as UserJwt;
    if (!user?.tenantId) throw new BadRequestException('Invalid user');
    return this.parentsService.listAllParents(user.tenantId, search);
  }

  @Post('admin/:id/reset-password')
  @Roles('SCHOOL_ADMIN')
  async resetPassword(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = req.user as UserJwt;
    if (!user?.tenantId) throw new BadRequestException('Invalid user');
    return this.parentsService.resetParentPassword(id, user.tenantId);
  }

  @Post('admin/create')
  @Roles('SCHOOL_ADMIN')
  async adminCreateParent(
    @Body() body: { name: string; email: string; phone?: string },
    @Req() req: Request,
  ) {
    const user = req.user as UserJwt;
    if (!user?.tenantId) throw new BadRequestException('Invalid user');
    return this.parentsService.createParent(
      { name: body.name, email: body.email, password: 'Welcome@Scholaro2026' },
      user.tenantId,
    );
  }

  // ── Parent endpoints (PARENT) ──

  @Get('me/students')
  @Roles('PARENT')
  async getMyStudents(@Req() req: Request) {
    const user = req.user as UserJwt;
    if (!user?.userId || !user?.tenantId)
      throw new BadRequestException('Invalid user');
    return this.parentsService.getMyStudents(user.userId, user.tenantId);
  }

  @Get('me/children')
  @Roles('PARENT')
  async getMyChildren(@Req() req: Request) {
    const user = req.user as UserJwt;
    if (!user?.userId || !user?.tenantId)
      throw new BadRequestException('Invalid user');
    return this.parentsService.getMyChildren(user.userId, user.tenantId);
  }

  @Get('student/:studentId/attendance')
  @Roles('PARENT')
  async getStudentAttendance(
    @Req() req: Request,
    @Param('studentId') studentId: string,
    @Query('date') date?: string,
  ) {
    const user = req.user as UserJwt;
    if (!user?.userId || !user?.tenantId)
      throw new BadRequestException('Invalid user');
    return this.parentsService.getStudentAttendance(
      studentId,
      user.userId,
      user.tenantId,
      date,
    );
  }

  @Post('link')
  @Roles('SCHOOL_ADMIN')
  async linkParentToStudent(
    @Body() dto: LinkParentStudentDto,
    @Req() req: Request,
  ) {
    const user = req.user as UserJwt;
    if (!user?.tenantId) throw new BadRequestException('Invalid user');
    return this.parentsService.linkParentToStudent(dto, user.tenantId);
  }

  @Get('student/:studentId/fees')
  @Roles('PARENT')
  async getStudentFees(
    @Req() req: Request,
    @Param('studentId') studentId: string,
  ) {
    const user = req.user as UserJwt;
    if (!user?.userId || !user?.tenantId)
      throw new BadRequestException('Invalid user');
    return this.parentsService.getStudentFees(
      studentId,
      user.userId,
      user.tenantId,
    );
  }

  @Post()
  @Roles('PARENT')
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
