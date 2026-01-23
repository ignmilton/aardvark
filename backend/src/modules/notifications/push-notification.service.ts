import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSubscription } from '@entities';
import * as webpush from 'web-push';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    @InjectRepository(PushSubscription)
    private readonly pushSubscriptionRepository: Repository<PushSubscription>,
  ) {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@aardvark.com';

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      this.logger.log('Web Push VAPID credentials configured');
    } else {
      this.logger.warn('VAPID keys not configured - push notifications disabled');
    }
  }

  /**
   * Subscribe a user to push notifications
   */
  async subscribe(
    userId: string,
    endpoint: string,
    p256dh: string,
    auth: string,
    userAgent?: string,
  ): Promise<PushSubscription> {
    // Upsert subscription (update if endpoint exists)
    const existing = await this.pushSubscriptionRepository.findOne({
      where: { endpoint },
    });

    if (existing) {
      existing.userId = userId;
      existing.p256dh = p256dh;
      existing.auth = auth;
      existing.userAgent = userAgent || existing.userAgent;
      return this.pushSubscriptionRepository.save(existing);
    }

    const subscription = this.pushSubscriptionRepository.create({
      userId,
      endpoint,
      p256dh,
      auth,
      userAgent,
    });

    return this.pushSubscriptionRepository.save(subscription);
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.pushSubscriptionRepository.delete({ userId, endpoint });
  }

  /**
   * Send push notification to a specific user
   */
  async sendToUser(
    userId: string,
    payload: {
      title: string;
      body: string;
      url?: string;
      tag?: string;
      id?: string;
      actions?: Array<{ action: string; title: string }>;
    },
  ): Promise<void> {
    const subscriptions = await this.pushSubscriptionRepository.find({
      where: { userId },
    });

    if (subscriptions.length === 0) return;

    const pushPayload = JSON.stringify(payload);

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          pushPayload,
        ),
      ),
    );

    // Remove expired/invalid subscriptions
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'rejected') {
        const statusCode = (result.reason as any)?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription no longer valid
          await this.pushSubscriptionRepository.remove(subscriptions[i]);
          this.logger.debug(
            `Removed expired push subscription for user ${userId}`,
          );
        } else {
          this.logger.error(
            `Push notification failed for user ${userId}: ${result.reason}`,
          );
        }
      }
    }
  }

  /**
   * Send push notification to multiple users
   */
  async sendToUsers(
    userIds: string[],
    payload: {
      title: string;
      body: string;
      url?: string;
      tag?: string;
    },
  ): Promise<void> {
    await Promise.allSettled(
      userIds.map((userId) => this.sendToUser(userId, payload)),
    );
  }
}
