import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import express from 'express';
import { RegisterUserDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() registerDto: RegisterUserDto,
    @Req() req: express.Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.authService.register(registerDto, tenantId);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Req() req: express.Request) {
    const tenantId = req['tenantId'] as string;
    return this.authService.login(loginDto, tenantId);
  }

  @Post('forgot-password')
  async forgotPassword(
    @Body('email') email: string,
    @Body('school_code') schoolCode: string,
    @Req() req: express.Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.authService.requestPasswordReset(email, tenantId, schoolCode);
  }

  @Post('reset-password')
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
    @Body('school_code') schoolCode: string,
    @Req() req: express.Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.authService.resetPassword(token, newPassword, tenantId, schoolCode);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @Body('currentPassword') currentPassword: string,
    @Body('newPassword') newPassword: string,
    @Req() req: express.Request,
  ) {
    const userId = (req as any).user?.userId;
    return this.authService.changePassword(userId, currentPassword, newPassword);
  }
}
