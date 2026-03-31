import { Controller, Post, Param, Body, UseGuards, BadRequestException, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { Request } from 'express';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
