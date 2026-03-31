import { Controller, Post, Body, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import express from 'express';
import { RegisterUserDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

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
}
