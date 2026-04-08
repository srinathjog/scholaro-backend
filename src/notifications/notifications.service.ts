import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as webPush from 'web-push';
import { PushSubscription } from './push-subscription.entity';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { ParentStudent } from '../parents/parent-student.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(PushSubscription)
    private readonly subscriptionRepo: Repository<PushSubscription>,
    @InjectRepository(ParentStudent)
    private readonly parentStudentRepo: Repository<ParentStudent>,
    private readonly configService: ConfigService,
  ) {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.configService.get<string>('VAPID_SUBJECT') || 'mailto:admin@scholaro.app';

    if (publicKey && privateKey) {
      webPush.setVapidDetails(subject, publicKey, privateKey);
      this.logger.log('VAPID keys configured');
    } else {
      this.logger.warn('VAPID keys not found — push notifications disabled');
    }
  }

  /** Save or update a push subscription for a user */
  async subscribe(userId: string, tenantId: string, dto: SubscribePushDto): Promise<PushSubscription> {
    // Upsert by endpoint — same browser re-subscribing
    const existing = await this.subscriptionRepo.findOne({
      where: { user_id: userId, tenant_id: tenantId, endpoint: dto.endpoint },
    });
    if (existing) {
      existing.p256dh = dto.keys.p256dh;
      existing.auth = dto.keys.auth;
      return this.subscriptionRepo.save(existing);
    }

    const sub = this.subscriptionRepo.create({
      user_id: userId,
      tenant_id: tenantId,
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
    });
    return this.subscriptionRepo.save(sub);
  }

  /** Remove a subscription (user unsubscribed or endpoint expired) */
  async unsubscribe(userId: string, tenantId: string, endpoint: string): Promise<void> {
    await this.subscriptionRepo.delete({ user_id: userId, tenant_id: tenantId, endpoint });
  }

  /** Get the VAPID public key for frontend registration */
  getPublicKey(): string {
    return this.configService.get<string>('VAPID_PUBLIC_KEY') || '';
  }

  /** Build a standardized push notification payload with badge, renotify, tag */
  private buildPushPayload(payload: {
    title: string;
    body: string;
    icon?: string;
    url?: string;
    tag?: string;
  }): string {
    return JSON.stringify({
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icons/scholaro-192.png',
        badge: '/icons/scholaro-192.png',
        vibrate: [100, 50, 100],
        tag: payload.tag || 'scholaro-update',
        renotify: true,
        data: {
          onActionClick: {
            default: {
              operation: 'navigateLastFocusedOrOpen',
              url: payload.url || '/parent/timeline',
            },
          },
        },
      },
    });
  }

  /**
   * Send a push notification to all parents of a given student.
   * Called from DailyLogsService / ActivitiesService after saving.
   */
  async notifyParentsOfStudent(
    studentId: string,
    tenantId: string,
    payload: { title: string; body: string; icon?: string; url?: string },
  ): Promise<void> {
    // 1. Find all parent user IDs linked to this student
    const links = await this.parentStudentRepo.find({
      where: { student_id: studentId, tenant_id: tenantId },
    });
    const parentUserIds = links.map((l) => l.parent_user_id);
    if (!parentUserIds.length) return;

    // 2. Find all push subscriptions for those parents
    const subscriptions = parentUserIds.length
      ? await this.subscriptionRepo.find({
          where: { user_id: In(parentUserIds), tenant_id: tenantId },
        })
      : [];
    if (!subscriptions.length) return;

    // 3. Send to each subscription (Angular NGSW format)
    const pushPayload = this.buildPushPayload(payload);

    const staleEndpoints: string[] = [];

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            pushPayload,
          );
          this.logger.log(`Push sent to ${sub.endpoint.slice(0, 50)}...`);
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            // Subscription expired — mark for cleanup
            staleEndpoints.push(sub.endpoint);
            this.logger.warn(`Stale subscription (${err.statusCode}): ${sub.endpoint.slice(0, 50)}`);
          } else {
            this.logger.error(`Push failed (${err.statusCode}): ${err.message}`);
          }
        }
      }),
    );

    // 4. Clean up expired subscriptions
    if (staleEndpoints.length) {
      for (const endpoint of staleEndpoints) {
        await this.subscriptionRepo.delete({ endpoint });
      }
      this.logger.log(`Cleaned up ${staleEndpoints.length} expired subscription(s)`);
    }
  }

  /**
   * Send a push notification to all parents with students enrolled in a class.
   * Used for activity broadcasts (photos, class updates).
   */
  async notifyParentsOfClass(
    classId: string,
    tenantId: string,
    payload: { title: string; body: string; icon?: string; url?: string },
  ): Promise<void> {
    // Find all enrollments for this class → student IDs → parent links → push subs
    const enrollments = await this.parentStudentRepo.manager
      .getRepository('enrollments')
      .find({ where: { class_id: classId, tenant_id: tenantId, status: 'active' } });

    const studentIds = [...new Set((enrollments as any[]).map((e) => e.student_id))];
    if (!studentIds.length) return;

    // Deduplicate parent user IDs across all students in this class
    const links = studentIds.length
      ? await this.parentStudentRepo.find({
          where: { student_id: In(studentIds), tenant_id: tenantId },
        })
      : [];
    const parentUserIds = [...new Set(links.map((l) => l.parent_user_id))];
    if (!parentUserIds.length) return;

    // Gather all subscriptions
    const subscriptions = await this.subscriptionRepo.find({
      where: { user_id: In(parentUserIds), tenant_id: tenantId },
    });
    if (!subscriptions.length) return;

    const pushPayload = this.buildPushPayload(payload);

    const staleEndpoints: string[] = [];
    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            pushPayload,
          );
          this.logger.log(`Class push sent to ${sub.endpoint.slice(0, 50)}...`);
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            staleEndpoints.push(sub.endpoint);
            this.logger.warn(`Stale subscription (${err.statusCode}): ${sub.endpoint.slice(0, 50)}`);
          } else {
            this.logger.error(`Class push failed (${err.statusCode}): ${err.message}`);
          }
        }
      }),
    );

    if (staleEndpoints.length) {
      for (const endpoint of staleEndpoints) {
        await this.subscriptionRepo.delete({ endpoint });
      }
    }
  }

  /**
   * Test push: send a test notification to a specific user.
   * Used for debugging push delivery.
   */
  async testPush(userId: string, tenantId: string): Promise<{ sent: number; failed: number; stale: number }> {
    const subs = await this.subscriptionRepo.find({
      where: { user_id: userId, tenant_id: tenantId },
    });

    if (!subs.length) {
      this.logger.warn(`No push subscriptions found for user ${userId}`);
      return { sent: 0, failed: 0, stale: 0 };
    }

    const payload = this.buildPushPayload({
      title: '🔔 Scholaro Test',
      body: 'Push notifications are working! You will receive activity updates here.',
    });

    let sent = 0, failed = 0, stale = 0;
    for (const sub of subs) {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
        this.logger.log(`Test push delivered: ${sub.endpoint.slice(0, 50)}`);
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          stale++;
          await this.subscriptionRepo.delete({ endpoint: sub.endpoint });
          this.logger.warn(`Cleaned stale subscription: ${sub.endpoint.slice(0, 50)}`);
        } else {
          failed++;
          this.logger.error(`Test push failed (${err.statusCode}): ${err.message}`);
        }
      }
    }

    return { sent, failed, stale };
  }
}
