import { Controller, Post, Delete, Get, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { SubscribePushDto } from './dto/subscribe-push.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** Get the VAPID public key — needed by frontend to subscribe */
  @Get('vapid-public-key')
  getVapidPublicKey() {
    return { publicKey: this.notificationsService.getPublicKey() };
  }

  /** Subscribe the current user's browser for push notifications */
  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  async subscribe(@Body() dto: SubscribePushDto, @Req() req: any) {
    const { userId, tenantId } = req.user;
    await this.notificationsService.subscribe(userId, tenantId, dto);
    return { subscribed: true };
  }

  /** Unsubscribe the current user's browser */
  @UseGuards(JwtAuthGuard)
  @Delete('subscribe')
  async unsubscribe(@Body() body: { endpoint: string }, @Req() req: any) {
    const { userId, tenantId } = req.user;
    await this.notificationsService.unsubscribe(userId, tenantId, body.endpoint);
    return { unsubscribed: true };
  }

  /** Send a test push to the current user — for debugging */
  @UseGuards(JwtAuthGuard)
  @Post('test-push')
  async testPush(@Req() req: any) {
    const { userId, tenantId } = req.user;
    const result = await this.notificationsService.testPush(userId, tenantId);
    return result;
  }
}
