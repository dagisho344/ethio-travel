/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  BusinessMemberRole,
  BusinessMemberStatus,
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationStatus,
  MessageStatus,
  UserStatus,
} from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CreateMessageDto } from './messaging/dto/create-message.dto';
import { MessagingService } from './messaging/messaging.service';

const userId = '11111111-1111-4111-8111-111111111111';
const ownerId = '22222222-2222-4222-8222-222222222222';
const businessId = '33333333-3333-4333-8333-333333333333';
const bookingId = '44444444-4444-4444-8444-444444444444';
const conversationId = '55555555-5555-4555-8555-555555555555';
const messageId = '66666666-6666-4666-8666-666666666666';

function profile(firstName: string) {
  return { firstName, lastName: null };
}

function conversation(overrides = {}) {
  return {
    id: conversationId,
    businessId,
    bookingId: null,
    subject: 'Trip question',
    status: ConversationStatus.ACTIVE,
    lastMessageAt: null,
    archivedAt: null,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    business: { id: businessId, name: 'Demo Guest House', slug: 'demo' },
    booking: null,
    members: [
      {
        id: 'member-traveler',
        userId,
        role: ConversationMemberRole.TRAVELER,
        status: ConversationMemberStatus.ACTIVE,
        lastReadAt: null,
        createdAt: new Date('2030-01-01T00:00:00.000Z'),
        user: { profile: profile('Traveler') },
      },
      {
        id: 'member-business',
        userId: ownerId,
        role: ConversationMemberRole.BUSINESS_MEMBER,
        status: ConversationMemberStatus.ACTIVE,
        lastReadAt: null,
        createdAt: new Date('2030-01-01T00:00:00.000Z'),
        user: { profile: profile('Owner') },
      },
    ],
    ...overrides,
  };
}

function message(overrides = {}) {
  return {
    id: messageId,
    conversationId,
    body: 'Hello there',
    status: MessageStatus.SENT,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    sender: { profile: profile('Traveler') },
    ...overrides,
  };
}

function setup(
  events?: { messageCreated: jest.Mock },
  notifications?: { createForUsers: jest.Mock },
) {
  const tx = {
    conversation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    conversationMember: { updateMany: jest.fn() },
    message: { create: jest.fn() },
  };
  const prisma = {
    user: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: userId, status: UserStatus.ACTIVE }),
    },
    business: { findFirst: jest.fn() },
    businessMember: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([
        {
          userId: ownerId,
          role: BusinessMemberRole.OWNER,
          status: BusinessMemberStatus.ACTIVE,
        },
      ]),
    },
    booking: { findUnique: jest.fn() },
    conversation: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      count: jest.fn(),
    },
    conversationMember: { findFirst: jest.fn(), updateMany: jest.fn() },
    message: { findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn((input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      return (input as (client: typeof tx) => unknown)(tx);
    }),
  };
  const service = new MessagingService(
    prisma as never,
    events as never,
    notifications as never,
  );
  return { service, prisma, tx };
}

describe('MessagingService', () => {
  it('creates a traveler conversation with a public business and active business recipients', async () => {
    const { service, prisma } = setup();
    prisma.businessMember.findFirst.mockResolvedValue(null);
    prisma.business.findFirst.mockResolvedValue({ id: businessId });
    prisma.conversation.create.mockResolvedValue(conversation());

    const result = await service.createConversation(userId, {
      businessId,
      subject: ' Trip question ',
    });

    expect(result.subject).toBe('Trip question');
    expect(prisma.business.findFirst).toHaveBeenCalled();
    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId,
          members: expect.objectContaining({
            createMany: expect.objectContaining({
              data: expect.arrayContaining([
                expect.objectContaining({
                  userId,
                  role: ConversationMemberRole.TRAVELER,
                }),
                expect.objectContaining({
                  userId: ownerId,
                  role: ConversationMemberRole.BUSINESS_MEMBER,
                }),
              ]),
            }),
          }),
        }),
      }),
    );
  });

  it('rejects booking conversations when booking does not belong to the selected business', async () => {
    const { service, prisma } = setup();
    prisma.businessMember.findFirst.mockResolvedValue(null);
    prisma.booking.findUnique.mockResolvedValue({
      id: bookingId,
      businessId: '99999999-9999-4999-8999-999999999999',
      travelerId: userId,
    });

    await expect(
      service.createConversation(userId, { businessId, bookingId }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not expose conversations to non-members', async () => {
    const { service, prisma } = setup();
    prisma.conversationMember.findFirst.mockResolvedValue(null);

    await expect(
      service.findById(userId, conversationId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists only conversations where the authenticated user is an active member', async () => {
    const { service, prisma } = setup();
    prisma.conversation.findMany.mockResolvedValue([conversation()]);
    prisma.conversation.count.mockResolvedValue(1);

    const result = await service.findMine(userId, { page: 1, limit: 20 });

    expect(result.meta.total).toBe(1);
    expect(prisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          members: {
            some: { userId, status: ConversationMemberStatus.ACTIVE },
          },
        }),
      }),
    );
  });

  it('prevents sending messages to archived conversations', async () => {
    const { service, prisma, tx } = setup();
    prisma.conversationMember.findFirst.mockResolvedValue({ id: 'member-id' });
    tx.conversation.findUnique.mockResolvedValue({
      id: conversationId,
      status: ConversationStatus.ARCHIVED,
    });

    await expect(
      service.createMessage(userId, conversationId, { body: 'Hello' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates messages only for active members and updates read/conversation timestamps', async () => {
    const { service, prisma, tx } = setup();
    prisma.conversationMember.findFirst.mockResolvedValue({ id: 'member-id' });
    tx.conversation.findUnique.mockResolvedValue({
      id: conversationId,
      status: ConversationStatus.ACTIVE,
    });
    tx.message.create.mockResolvedValue(message());

    const result = await service.createMessage(userId, conversationId, {
      body: 'Hello there',
    });

    expect(result.body).toBe('Hello there');
    expect(tx.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ conversationId, senderId: userId }),
      }),
    );
    expect(tx.conversation.update).toHaveBeenCalled();
    expect(tx.conversationMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { conversationId, userId } }),
    );
  });

  it('migration creates communication tables with membership and message checks', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'prisma/migrations/20260908000001_messaging_backend/migration.sql',
      ),
      'utf8',
    );
    expect(sql).toContain('CREATE TABLE "conversations"');
    expect(sql).toContain('CREATE TABLE "conversation_members"');
    expect(sql).toContain('CREATE TABLE "messages"');
    expect(sql).toContain('messages_body_not_blank_check');
    expect(sql).toContain('conversation_members_conversation_id_user_id_key');
    expect(sql).toContain('ON DELETE RESTRICT');
  });
  it('marks only the authenticated member read without modifying messages', async () => {
    const { service, prisma } = setup();
    prisma.conversationMember.findFirst.mockResolvedValue({
      id: 'member-id',
      role: ConversationMemberRole.TRAVELER,
      conversation: { businessId },
    });

    const result = await service.markRead(userId, conversationId);

    expect(result.conversationId).toBe(conversationId);
    expect(prisma.conversationMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ conversationId, userId }),
        data: expect.objectContaining({ lastReadAt: expect.any(Date) }),
      }),
    );
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });

  it('does not allow a non-member to mark a conversation read', async () => {
    const { service, prisma } = setup();
    prisma.conversationMember.findFirst.mockResolvedValue(null);

    await expect(
      service.markRead(userId, conversationId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.conversationMember.updateMany).not.toHaveBeenCalled();
  });

  it('calculates unread messages per member and excludes the current sender', async () => {
    const { service, prisma } = setup();
    prisma.conversation.findMany.mockResolvedValue([conversation()]);
    prisma.conversation.count.mockResolvedValue(1);
    prisma.message.count.mockResolvedValue(2);

    const result = await service.findMine(userId, { page: 1, limit: 20 });

    expect(result.data[0]?.unreadCount).toBe(2);
    expect(prisma.message.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        conversationId,
        senderId: { not: userId },
        status: MessageStatus.SENT,
      }),
    });
  });

  it('keeps business staff read state independent per user', async () => {
    const staffId = '77777777-7777-4777-8777-777777777777';
    const { service, prisma } = setup();
    prisma.conversationMember.findFirst.mockResolvedValue({
      id: 'business-member',
      role: ConversationMemberRole.BUSINESS_MEMBER,
      conversation: { businessId },
    });
    prisma.businessMember.findFirst.mockResolvedValue({ id: 'active-member' });

    await service.markRead(ownerId, conversationId);
    await service.markRead(staffId, conversationId);

    expect(prisma.conversationMember.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ userId: ownerId }),
      }),
    );
    expect(prisma.conversationMember.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ userId: staffId }),
      }),
    );
  });

  it('requires a current active business membership for business conversation access', async () => {
    const { service, prisma } = setup();
    prisma.conversationMember.findFirst.mockResolvedValue({
      id: 'business-member',
      role: ConversationMemberRole.BUSINESS_MEMBER,
      conversation: { businessId },
    });
    prisma.businessMember.findFirst.mockResolvedValue(null);

    await expect(
      service.assertConversationAccess(ownerId, conversationId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('preserves active-member history access after a business becomes non-public', async () => {
    const { service, prisma } = setup();
    prisma.conversationMember.findFirst.mockResolvedValue({
      id: 'member-id',
      role: ConversationMemberRole.TRAVELER,
      conversation: { businessId },
    });
    prisma.conversation.findUnique.mockResolvedValue(conversation());

    const result = await service.findById(userId, conversationId);

    expect(result.id).toBe(conversationId);
    expect(prisma.business.findFirst).not.toHaveBeenCalled();
  });

  it('emits a realtime message only after its transaction persists', async () => {
    const events = { messageCreated: jest.fn() };
    const { service, prisma, tx } = setup(events);
    prisma.conversationMember.findFirst.mockResolvedValue({
      id: 'member-id',
      role: ConversationMemberRole.TRAVELER,
      conversation: { businessId },
    });
    tx.conversation.findUnique.mockResolvedValue({
      id: conversationId,
      status: ConversationStatus.ACTIVE,
    });
    tx.message.create.mockResolvedValue(message());

    const result = await service.createMessage(userId, conversationId, {
      body: 'Hello there',
    });

    expect(events.messageCreated).toHaveBeenCalledWith(result);
  });

  it('does not emit a realtime message when persistence fails', async () => {
    const events = { messageCreated: jest.fn() };
    const { service, prisma, tx } = setup(events);
    prisma.conversationMember.findFirst.mockResolvedValue({
      id: 'member-id',
      role: ConversationMemberRole.TRAVELER,
      conversation: { businessId },
    });
    tx.conversation.findUnique.mockResolvedValue({
      id: conversationId,
      status: ConversationStatus.ACTIVE,
    });
    tx.message.create.mockRejectedValue(new Error('Database failure'));

    await expect(
      service.createMessage(userId, conversationId, { body: 'Hello there' }),
    ).rejects.toThrow('Database failure');
    expect(events.messageCreated).not.toHaveBeenCalled();
  });

  it('rejects blank and oversized message bodies at validation', async () => {
    const blankErrors = await validate(
      plainToInstance(CreateMessageDto, { body: '   ' }),
    );
    const longErrors = await validate(
      plainToInstance(CreateMessageDto, { body: 'x'.repeat(5001) }),
    );

    expect(blankErrors).not.toHaveLength(0);
    expect(longErrors).not.toHaveLength(0);
  });
  it('allows an active business member to access its own conversation', async () => {
    const { service, prisma } = setup();
    prisma.conversationMember.findFirst.mockResolvedValue({
      id: 'business-member',
      role: ConversationMemberRole.BUSINESS_MEMBER,
      conversation: { businessId },
    });
    prisma.businessMember.findFirst.mockResolvedValue({ id: 'active-member' });

    await expect(
      service.assertConversationAccess(ownerId, conversationId),
    ).resolves.toBeUndefined();
  });

  it('permits sending in an existing active thread after the business is suspended or archived', async () => {
    const { service, prisma, tx } = setup();
    prisma.conversationMember.findFirst.mockResolvedValue({
      id: 'member-id',
      role: ConversationMemberRole.TRAVELER,
      conversation: { businessId },
    });
    tx.conversation.findUnique.mockResolvedValue({
      id: conversationId,
      status: ConversationStatus.ACTIVE,
    });
    tx.message.create.mockResolvedValue(message());

    await expect(
      service.createMessage(userId, conversationId, {
        body: 'Existing thread',
      }),
    ).resolves.toMatchObject({ conversationId });
    expect(prisma.business.findFirst).not.toHaveBeenCalled();
  });
  it('notifies current active business members even when they are not stored as conversation members', async () => {
    const staffId = '77777777-7777-4777-8777-777777777777';
    const notifications = { createForUsers: jest.fn().mockResolvedValue([]) };
    const { service, prisma, tx } = setup(undefined, notifications);
    prisma.conversationMember.findFirst.mockResolvedValue({
      id: 'member-id',
      role: ConversationMemberRole.TRAVELER,
      conversation: { businessId },
    });
    tx.conversation.findUnique.mockResolvedValue({
      id: conversationId,
      status: ConversationStatus.ACTIVE,
    });
    tx.message.create.mockResolvedValue(message());
    prisma.conversation.findUnique.mockResolvedValue({
      businessId,
      members: [
        { userId, role: ConversationMemberRole.TRAVELER },
        { userId: ownerId, role: ConversationMemberRole.BUSINESS_MEMBER },
      ],
    });
    prisma.businessMember.findMany.mockResolvedValue([{ userId: staffId }]);

    await service.createMessage(userId, conversationId, {
      body: 'Hello there',
    });

    expect(notifications.createForUsers).toHaveBeenCalledWith(
      [staffId],
      expect.objectContaining({ actorUserId: userId }),
    );
  });
});
