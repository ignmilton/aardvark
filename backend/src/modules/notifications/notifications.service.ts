import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Notification, Follow } from '@entities';
import { NotificationType } from '@aardvark/shared';
import { NotificationQueryDto } from './dto';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Create a new notification for a user
   */
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>,
    linkUrl?: string,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      userId,
      type,
      title,
      message,
      data: data || {},
      linkUrl: linkUrl || null,
      isRead: false,
      readAt: null,
    });

    const savedNotification = await this.notificationRepository.save(notification);

    // Send real-time notification
    await this.sendRealTimeNotification(userId, savedNotification);

    return savedNotification;
  }

  /**
   * Get notifications for a user with pagination and filters
   */
  async getUserNotifications(userId: string, query: NotificationQueryDto) {
    const { unreadOnly, page = 1, limit: rawLimit = 20 } = query;
    const limit = Math.min(Math.max(1, rawLimit), 50);

    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId });

    // Apply unread filter
    if (unreadOnly) {
      queryBuilder.andWhere('notification.isRead = :isRead', { isRead: false });
    }

    // Sort by creation date (newest first)
    queryBuilder.orderBy('notification.createdAt', 'DESC');

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [notifications, total] = await queryBuilder.getManyAndCount();

    return {
      data: notifications,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark specific notifications as read
   */
  async markAsRead(userId: string, notificationIds: string[]): Promise<void> {
    // Verify all notifications belong to the user
    const notifications = await this.notificationRepository.find({
      where: {
        id: In(notificationIds),
        userId,
      },
    });

    if (notifications.length !== notificationIds.length) {
      throw new ForbiddenException('Some notifications do not belong to this user');
    }

    // Update notifications
    const now = new Date();
    await this.notificationRepository.update(
      {
        id: In(notificationIds),
        userId,
        isRead: false, // Only update unread notifications
      },
      {
        isRead: true,
        readAt: now,
      },
    );
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    const now = new Date();
    await this.notificationRepository.update(
      {
        userId,
        isRead: false,
      },
      {
        isRead: true,
        readAt: now,
      },
    );
  }

  /**
   * Delete a notification
   */
  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.notificationRepository.remove(notification);
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  /**
   * Send notification to all followers of a user (batched to prevent memory/DB overload)
   */
  async notifyFollowers(
    authorId: string,
    type: NotificationType,
    title: string,
    message: string,
    data: Record<string, unknown>,
    linkUrl?: string,
  ): Promise<void> {
    const BATCH_SIZE = 100;

    // Get all followers of the author
    const follows = await this.followRepository.find({
      where: { followingId: authorId },
      select: ['followerId'],
    });

    const followerIds = follows.map((f) => f.followerId);

    if (followerIds.length === 0) {
      this.logger.debug(`Author ${authorId} has no followers to notify`);
      return;
    }

    // Process in batches to avoid memory and DB overload
    for (let i = 0; i < followerIds.length; i += BATCH_SIZE) {
      const batch = followerIds.slice(i, i + BATCH_SIZE);

      const notifications = batch.map((followerId) =>
        this.notificationRepository.create({
          userId: followerId,
          type,
          title,
          message,
          data,
          linkUrl: linkUrl || null,
          isRead: false,
          readAt: null,
        }),
      );

      const savedNotifications = await this.notificationRepository.save(notifications);

      // Send real-time notifications for this batch
      for (const notification of savedNotifications) {
        await this.sendRealTimeNotification(notification.userId, notification);
      }
    }

    this.logger.log(`Notified ${followerIds.length} followers of author ${authorId}`);
  }

  /**
   * Send real-time notification via WebSocket
   */
  async sendRealTimeNotification(
    userId: string,
    notification: Notification,
  ): Promise<void> {
    try {
      this.notificationsGateway.sendToUser(userId, 'notification', notification);
    } catch (error) {
      this.logger.error(
        `Failed to send real-time notification to user ${userId}: ${error.message}`,
      );
      // Don't throw - real-time notification is optional
    }
  }
}
