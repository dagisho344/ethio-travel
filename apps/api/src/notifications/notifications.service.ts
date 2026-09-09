import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  BusinessMemberRole,
  BusinessMemberStatus,
  NotificationType,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { paginate } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import {
  CreatedNotificationEvent,
  NotificationsEvents,
} from './notifications.events';

const notificationSelect = Prisma.validator<Prisma.NotificationSelect>()({
  id: true,
  type: true,
  title: true,
  body: true,
  actionUrl: true,
  readAt: true,
  createdAt: true,
  updatedAt: true,
});

const eventSelect = Prisma.validator<Prisma.NotificationSelect>()({
  recipientUserId: true,
  ...notificationSelect,
});

type NotificationRecord = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;
type EventRecord = Prisma.NotificationGetPayload<{
  select: typeof eventSelect;
}>;

export interface CreateNotificationInput {
  recipientUserId: string;
  actorUserId?: string;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string;
  dedupeKey?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: NotificationsEvents,
  ) {}

  async create(input: CreateNotificationInput): Promise<NotificationRecord> {
    this.validateInput(input);
    try {
      const notification = await this.prisma.notification.create({
        data: {
          recipientUserId: input.recipientUserId,
          actorUserId: input.actorUserId,
          type: input.type,
          title: input.title.trim(),
          body: input.body.trim(),
          actionUrl: input.actionUrl,
          dedupeKey: input.dedupeKey,
          metadata: input.metadata,
        },
        select: eventSelect,
      });
      this.events.notificationCreated(this.toEvent(notification));
      return this.toNotification(notification);
    } catch (error) {
      if (input.dedupeKey && this.isUniqueConflict(error)) {
        const existing = await this.prisma.notification.findUniqueOrThrow({
          where: { dedupeKey: input.dedupeKey },
          select: notificationSelect,
        });
        return this.toNotification(existing);
      }
      throw error;
    }
  }

  async createForUsers(
    recipientUserIds: readonly string[],
    input: Omit<CreateNotificationInput, 'recipientUserId' | 'dedupeKey'> & {
      dedupePrefix: string;
    },
  ): Promise<NotificationRecord[]> {
    const recipients = [...new Set(recipientUserIds)].filter(
      (recipientUserId) => recipientUserId !== input.actorUserId,
    );
    return Promise.all(
      recipients.map((recipientUserId) =>
        this.create({
          ...input,
          recipientUserId,
          dedupeKey: `${input.dedupePrefix}:${recipientUserId}`,
        }),
      ),
    );
  }

  async notifyBusinessMembers(
    businessId: string,
    input: Omit<CreateNotificationInput, 'recipientUserId' | 'dedupeKey'> & {
      dedupePrefix: string;
      roles?: BusinessMemberRole[];
    },
  ): Promise<NotificationRecord[]> {
    const members = await this.prisma.businessMember.findMany({
      where: {
        businessId,
        status: BusinessMemberStatus.ACTIVE,
        role: input.roles ? { in: input.roles } : undefined,
        user: { status: UserStatus.ACTIVE },
      },
      select: { userId: true },
    });
    return this.createForUsers(
      members.map((member) => member.userId),
      input,
    );
  }

  async findMine(userId: string, query: NotificationQueryDto) {
    await this.ensureActiveUser(userId);
    const where: Prisma.NotificationWhereInput = {
      recipientUserId: userId,
      type: query.type,
      readAt: query.unreadOnly ? null : undefined,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        select: notificationSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return paginate(
      data.map((item) => this.toNotification(item)),
      total,
      query.page,
      query.limit,
    );
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    await this.ensureActiveUser(userId);
    return {
      count: await this.prisma.notification.count({
        where: { recipientUserId: userId, readAt: null },
      }),
    };
  }

  async markRead(userId: string, id: string): Promise<NotificationRecord> {
    await this.ensureActiveUser(userId);
    const now = new Date();
    const updated = await this.prisma.notification.updateMany({
      where: { id, recipientUserId: userId, readAt: null },
      data: { readAt: now },
    });
    if (updated.count === 1) {
      const notification = await this.prisma.notification.findFirst({
        where: { id, recipientUserId: userId },
        select: notificationSelect,
      });
      if (notification) return this.toNotification(notification);
    }
    const existing = await this.prisma.notification.findFirst({
      where: { id, recipientUserId: userId },
      select: notificationSelect,
    });
    if (!existing) throw new NotFoundException('Notification not found.');
    return this.toNotification(existing);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    await this.ensureActiveUser(userId);
    const result = await this.prisma.notification.updateMany({
      where: { recipientUserId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  private validateInput(input: CreateNotificationInput): void {
    if (!input.title.trim() || input.title.length > 160) {
      throw new Error('Notification title is invalid.');
    }
    if (!input.body.trim() || input.body.length > 500) {
      throw new Error('Notification body is invalid.');
    }
    if (
      input.actionUrl &&
      (!input.actionUrl.startsWith('/') || input.actionUrl.startsWith('//'))
    ) {
      throw new Error('Notification action URL is invalid.');
    }
  }

  private async ensureActiveUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    if (!user) throw new UnauthorizedException('Authentication required.');
  }

  private toNotification(notification: NotificationRecord): NotificationRecord {
    return notification;
  }

  private toEvent(notification: EventRecord): CreatedNotificationEvent {
    return notification;
  }

  private isUniqueConflict(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
