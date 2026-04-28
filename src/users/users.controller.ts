import { Controller, Post, Get, Delete, Param, Body, UseGuards, BadRequestException, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { Request } from 'express';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('staff')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  async getStaff(@Req() req: Request) {
    const tenantId = (req as any).tenantId || (req.user as any)?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenant');
    return this.usersService.getStaff(tenantId);
  }

  @Delete(':id')
  @Roles('SCHOOL_ADMIN')
  async removeStaff(
    @Param('id') userId: string,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || (req.user as any)?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenant');
    await this.usersService.removeStaff(userId, tenantId);
    return { success: true };
  }

  @Post(':id/roles')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  async assignRole(
    @Param('id') userId: string,
    @Body() body: { role: string },
    @Req() req: Request
  ) {
    const user = req.user as any;
    if (!user?.tenantId) throw new BadRequestException('Invalid user');
    return this.usersService.assignRole(userId, body.role, user.tenantId);
  }
}
