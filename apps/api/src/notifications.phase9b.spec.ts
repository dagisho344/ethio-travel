import { NotFoundException } from '@nestjs/common';
import { NotificationType, UserStatus } from '@prisma/client';
import { NotificationsService } from './notifications/notifications.service';

const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';
const notificationId = '33333333-3333-4333-8333-333333333333';

function record(overrides = {}) {
  return {
    id: notificationId,
    recipientUserId: userId,
    type: NotificationType.BOOKING_CREATED,
    title: 'Booking created',
    body: 'A booking was created.',
    actionUrl: '/bookings/example',
    readAt: null,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function setup() {
  const prisma = {
    user: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: userId, status: UserStatus.ACTIVE }),
    },
    notification: {
      create: jest.fn().mockResolvedValue(record()),
      findMany: jest.fn().mockResolvedValue([record()]),
      findFirst: jest.fn().mockResolvedValue(record()),
      findUniqueOrThrow: jest.fn().mockResolvedValue(record()),
      count: jest.fn().mockResolvedValue(1),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    businessMember: {
      findMany: jest.fn().mockResolvedValue([{ userId: otherUserId }]),
    },
    $transaction: jest.fn((items: unknown[]) => Promise.all(items)),
  };
  const events = { notificationCreated: jest.fn() };
  return {
    events,
    prisma,
    service: new NotificationsService(prisma as never, events as never),
  };
}

describe('NotificationsService', () => {
  it('persists a notification before emitting its realtime event', async () => {
    const { service, events, prisma } = setup();
    const created = await service.create({
      recipientUserId: userId,
      type: NotificationType.BOOKING_CREATED,
      title: 'Booking created',
      body: 'A booking was created.',
      actionUrl: '/bookings/example',
      dedupeKey: 'booking:1',
    });
    expect(created.id).toBe(notificationId);
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(events.notificationCreated).toHaveBeenCalledWith(
      expect.objectContaining({ recipientUserId: userId }),
    );
  });

  it('lists only the current user notifications newest first with pagination and filters', async () => {
    const { service, prisma } = setup();
    await service.findMine(userId, {
      page: 2,
      limit: 10,
      unreadOnly: true,
      type: NotificationType.MESSAGE_RECEIVED,
    });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          recipientUserId: userId,
          readAt: null,
          type: NotificationType.MESSAGE_RECEIVED,
        },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      }),
    );
  });

  it('counts only the current user unread notifications', async () => {
    const { service, prisma } = setup();
    await expect(service.unreadCount(userId)).resolves.toEqual({ count: 1 });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { recipientUserId: userId, readAt: null },
    });
  });

  it('marks only an owned notification read idempotently', async () => {
    const { service, prisma } = setup();
    await service.markRead(userId, notificationId);
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    await service.markRead(userId, notificationId);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: notificationId, recipientUserId: userId, readAt: null },
      }),
    );
  });

  it('does not reveal another user notification when marking read', async () => {
    const { service, prisma } = setup();
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    prisma.notification.findFirst.mockResolvedValue(null);
    await expect(
      service.markRead(userId, notificationId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.notification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: notificationId, recipientUserId: userId },
      }),
    );
  });

  it('marks all owned unread notifications read', async () => {
    const { service, prisma } = setup();
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });
    await expect(service.markAllRead(userId)).resolves.toEqual({ updated: 3 });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipientUserId: userId, readAt: null },
      }),
    );
  });

  it('excludes an actor from multi-recipient notification delivery', async () => {
    const { service, prisma } = setup();
    await service.createForUsers([userId, otherUserId, otherUserId], {
      actorUserId: userId,
      type: NotificationType.MESSAGE_RECEIVED,
      title: 'Message',
      body: 'You have a message.',
      actionUrl: '/messages/example',
      dedupePrefix: 'message:1',
    });
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          recipientUserId: otherUserId,
          actorUserId: userId,
          type: NotificationType.MESSAGE_RECEIVED,
          title: 'Message',
          body: 'You have a message.',
          actionUrl: '/messages/example',
          dedupeKey: 'message:1:' + otherUserId,
          metadata: undefined,
        },
      }),
    );
  });

  it('uses recipient-specific active business members and emits no event on failed persistence', async () => {
    const { service, prisma, events } = setup();
    prisma.notification.create.mockRejectedValueOnce(new Error('write failed'));
    await expect(
      service.notifyBusinessMembers('business-id', {
        type: NotificationType.BOOKING_CREATED,
        title: 'Booking',
        body: 'New booking.',
        actionUrl: '/business/bookings/example',
        dedupePrefix: 'booking:1',
      }),
    ).rejects.toThrow('write failed');
    expect(events.notificationCreated).not.toHaveBeenCalled();
  });
});
