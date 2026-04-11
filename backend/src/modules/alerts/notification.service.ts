import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppGateway } from '../gateway/gateway';
import {
  AlertTriggerContext,
  AlertWithChannels,
  NotificationChannel,
  NotificationSummary,
  PaginatedNotifications,
} from './alerts.types';
import { NotificationFilterDto } from './dto/notification-filter.dto';
import { Alert } from './entities/alert.entity';
import { Notification } from './entities/notification.entity';
import { EmailService } from './notifications/email.service';
import { TelegramService } from './notifications/telegram.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    private readonly telegramService: TelegramService,
    private readonly emailService: EmailService,
    private readonly gateway: AppGateway,
  ) {}

  async send(
    userId: string,
    context: AlertTriggerContext,
    channel: NotificationChannel,
  ): Promise<Notification> {
    const alert = await this.resolveAlert(context.alertId);
    const summary = this.buildSummary(context);
    const notification = await this.notificationRepository.save(
      this.notificationRepository.create({
        userId,
        alertId: context.alertId,
        type: context.type,
        title: summary.title,
        message: summary.message,
        channel,
        metadata: context.metadata ?? null,
        sentAt: new Date(),
      }),
    );

    await this.dispatchExternalChannels(alert, context, channel);

    this.gateway.emitNotificationNew(userId, {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      createdAt: notification.createdAt,
    });
    this.gateway.emitAlertTriggered(userId, context);
    this.gateway.emitUnreadCount(userId, await this.getUnreadCount(userId));

    return notification;
  }

  async getNotifications(
    userId: string,
    filters: NotificationFilterDto,
  ): Promise<PaginatedNotifications<Notification>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId });

    if (typeof filters.isRead === 'boolean') {
      queryBuilder.andWhere('notification.isRead = :isRead', { isRead: filters.isRead });
    }

    if (filters.type) {
      queryBuilder.andWhere('notification.type = :type', { type: filters.type });
    }

    queryBuilder.orderBy('notification.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [data, total, unread] = await Promise.all([
      queryBuilder.getMany(),
      queryBuilder.getCount(),
      this.getUnreadCount(userId),
    ]);

    return {
      data,
      total,
      unread,
      page,
      limit,
    };
  }

  async markAsRead(userId: string, notificationId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('No se encontro la notificacion solicitada para el usuario.');
    }

    notification.isRead = true;
    notification.readAt = new Date();

    const saved = await this.notificationRepository.save(notification);
    this.gateway.emitUnreadCount(userId, await this.getUnreadCount(userId));
    return saved;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const pending = await this.notificationRepository.find({
      where: { userId, isRead: false },
    });

    if (pending.length === 0) {
      this.gateway.emitUnreadCount(userId, 0);
      return 0;
    }

    const readAt = new Date();
    pending.forEach((notification) => {
      notification.isRead = true;
      notification.readAt = readAt;
    });

    await this.notificationRepository.save(pending);
    this.gateway.emitUnreadCount(userId, 0);
    return pending.length;
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  buildSummary(context: AlertTriggerContext): NotificationSummary {
    switch (context.type) {
      case 'PRICE_ABOVE':
      case 'PRICE_BELOW':
        return {
          title: `${context.symbol ?? 'Activo'} - Alerta de precio`,
          message: context.message,
          metadata: context.metadata,
        };
      case 'SCORE_ABOVE':
        return {
          title: `${context.symbol ?? 'Activo'} - Score de estrategia`,
          message: context.message,
          metadata: context.metadata,
        };
      case 'SENTIMENT_CHANGE':
        return {
          title: `Cambio de sentimiento - ${context.symbol ?? 'activo'}`,
          message: context.message,
          metadata: context.metadata,
        };
      case 'PORTFOLIO_PNL':
        return {
          title: 'Alerta de portfolio',
          message: context.message,
          metadata: context.metadata,
        };
      case 'TOKEN_LIMIT':
        return {
          title: 'Limite de tokens IA',
          message: context.message,
          metadata: context.metadata,
        };
      case 'MARKET_OPEN':
        return {
          title: 'Mercado argentino abierto',
          message: context.message,
          metadata: context.metadata,
        };
      default:
        return {
          title: 'Nueva alerta',
          message: context.message,
          metadata: context.metadata,
        };
    }
  }

  private async dispatchExternalChannels(
    alert: AlertWithChannels | null,
    context: AlertTriggerContext,
    channel: NotificationChannel,
  ): Promise<void> {
    if (!alert) {
      return;
    }

    if ((channel === NotificationChannel.TELEGRAM || channel === NotificationChannel.ALL) && alert.telegramChatId) {
      await this.telegramService.sendAlert(alert.telegramChatId, context);
    }

    if ((channel === NotificationChannel.EMAIL || channel === NotificationChannel.ALL) && alert.emailAddress) {
      await this.emailService.sendAlert(alert.emailAddress, context);
    }

    if (channel !== NotificationChannel.IN_APP && !alert.telegramChatId && !alert.emailAddress) {
      this.logger.warn(`La alerta ${alert.id} no tiene canales externos configurados.`);
    }
  }

  private async resolveAlert(alertId: string): Promise<AlertWithChannels | null> {
    const alert = await this.alertRepository.findOne({
      where: { id: alertId },
      select: ['id', 'userId', 'type', 'name', 'symbol', 'market', 'threshold', 'channel', 'telegramChatId', 'emailAddress'],
    });

    return alert ?? null;
  }
}
