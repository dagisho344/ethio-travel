import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  BusinessMemberRole,
  BusinessMemberStatus,
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationStatus,
  MessageStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { paginate, PaginatedResponse } from '../common/dto/pagination.dto';
import { publicBusinessWhere } from '../common/utils/public-visibility.util';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ConversationQueryDto,
  MessageQueryDto,
} from './dto/conversation-query.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagingEvents } from './messaging.events';
import { NotificationType } from '@prisma/client';

const conversationSelect = Prisma.validator<Prisma.ConversationSelect>()({
  id: true,
  businessId: true,
  bookingId: true,
  subject: true,
  status: true,
  lastMessageAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  business: { select: { id: true, name: true, slug: true } },
  booking: {
    select: {
      id: true,
      reference: true,
      bookingStatus: true,
      paymentStatus: true,
      service: { select: { id: true, name: true, slug: true } },
    },
  },
  members: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      userId: true,
      role: true,
      status: true,
      lastReadAt: true,
      createdAt: true,
      user: {
        select: {
          profile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  },
});

const messageSelect = Prisma.validator<Prisma.MessageSelect>()({
  id: true,
  conversationId: true,
  body: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  sender: {
    select: {
      profile: { select: { firstName: true, lastName: true } },
    },
  },
});

type ConversationRecord = Prisma.ConversationGetPayload<{
  select: typeof conversationSelect;
}>;
type MessageRecord = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;
type MemberCreateInput = {
  userId: string;
  role: ConversationMemberRole;
  status: ConversationMemberStatus;
};

const businessConversationRoles = [
  BusinessMemberRole.OWNER,
  BusinessMemberRole.MANAGER,
  BusinessMemberRole.STAFF,
];

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events?: MessagingEvents,
    private readonly notifications?: NotificationsService,
  ) {}

  async createConversation(userId: string, dto: CreateConversationDto) {
    await this.ensureActiveUser(userId);
    const requesterMembership = await this.findBusinessMembership(
      userId,
      dto.businessId,
    );
    const booking = dto.bookingId
      ? await this.prisma.booking.findUnique({
          where: { id: dto.bookingId },
          select: { id: true, businessId: true, travelerId: true },
        })
      : null;

    if (dto.bookingId && !booking)
      throw new NotFoundException('Booking not found.');
    if (booking && booking.businessId !== dto.businessId) {
      throw new BadRequestException(
        'Booking must belong to the selected business.',
      );
    }
    if (booking && booking.travelerId !== userId && !requesterMembership) {
      throw new ForbiddenException('Conversation access requires membership.');
    }
    if (!booking && !requesterMembership)
      await this.ensurePublicBusiness(dto.businessId);

    if (booking) {
      const existing = await this.prisma.conversation.findUnique({
        where: { bookingId: booking.id },
        select: conversationSelect,
      });
      if (existing) {
        await this.requireConversationMember(userId, existing.id);
        return this.toConversation(existing);
      }
    }

    const businessMembers = await this.activeBusinessMembers(dto.businessId);
    if (!businessMembers.length) {
      throw new ConflictException(
        'Business has no active messaging recipients.',
      );
    }

    const memberMap = new Map<string, MemberCreateInput>();
    if (booking) {
      memberMap.set(booking.travelerId, {
        userId: booking.travelerId,
        role: ConversationMemberRole.TRAVELER,
        status: ConversationMemberStatus.ACTIVE,
      });
    } else if (!requesterMembership) {
      memberMap.set(userId, {
        userId,
        role: ConversationMemberRole.TRAVELER,
        status: ConversationMemberStatus.ACTIVE,
      });
    }
    if (requesterMembership) {
      memberMap.set(userId, {
        userId,
        role: ConversationMemberRole.BUSINESS_MEMBER,
        status: ConversationMemberStatus.ACTIVE,
      });
    }
    for (const member of businessMembers) {
      memberMap.set(member.userId, {
        userId: member.userId,
        role: ConversationMemberRole.BUSINESS_MEMBER,
        status: ConversationMemberStatus.ACTIVE,
      });
    }

    try {
      const conversation = await this.prisma.conversation.create({
        data: {
          businessId: dto.businessId,
          bookingId: booking?.id,
          subject: this.trim(dto.subject),
          members: { createMany: { data: [...memberMap.values()] } },
        },
        select: conversationSelect,
      });
      return this.toConversation(conversation);
    } catch (error) {
      if (this.isUniqueConflict(error) && booking) {
        const existing = await this.prisma.conversation.findUniqueOrThrow({
          where: { bookingId: booking.id },
          select: conversationSelect,
        });
        return this.toConversation(existing);
      }
      throw error;
    }
  }

  async findMine(userId: string, query: ConversationQueryDto) {
    await this.ensureActiveUser(userId);
    const where: Prisma.ConversationWhereInput = {
      businessId: query.businessId,
      status: query.status,
      members: {
        some: { userId, status: ConversationMemberStatus.ACTIVE },
      },
      ...this.searchWhere(query.q),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        select: conversationSelect,
        orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.conversation.count({ where }),
    ]);
    return paginate(
      await Promise.all(
        records.map((record) => this.toConversationWithUnread(record, userId)),
      ),
      total,
      query.page,
      query.limit,
    );
  }

  async findById(userId: string, conversationId: string) {
    await this.requireConversationMember(userId, conversationId);
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: conversationSelect,
    });
    if (!conversation) throw new NotFoundException('Conversation not found.');
    return this.toConversation(conversation);
  }

  async findMessages(
    userId: string,
    conversationId: string,
    query: MessageQueryDto,
  ): Promise<PaginatedResponse<ReturnType<MessagingService['toMessage']>>> {
    await this.requireConversationMember(userId, conversationId);
    const where: Prisma.MessageWhereInput = {
      conversationId,
      status: MessageStatus.SENT,
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where,
        select: messageSelect,
        orderBy: { createdAt: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.message.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toMessage(record)),
      total,
      query.page,
      query.limit,
    );
  }

  async createMessage(
    userId: string,
    conversationId: string,
    dto: CreateMessageDto,
  ) {
    await this.requireConversationMember(userId, conversationId);
    const message = await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true, status: true },
      });
      if (!conversation) throw new NotFoundException('Conversation not found.');
      if (conversation.status !== ConversationStatus.ACTIVE) {
        throw new ConflictException(
          'Archived conversations cannot receive messages.',
        );
      }
      const now = new Date();
      const message = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          body: dto.body,
          status: MessageStatus.SENT,
        },
        select: messageSelect,
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now },
      });
      await tx.conversationMember.updateMany({
        where: { conversationId, userId },
        data: { lastReadAt: now },
      });
      return this.toMessage(message);
    });
    await this.notifyMessageRecipients(userId, message);
    this.events?.messageCreated(message);
    return message;
  }

  async markRead(userId: string, conversationId: string) {
    await this.requireConversationMember(userId, conversationId);
    const lastReadAt = new Date();
    await this.prisma.conversationMember.updateMany({
      where: {
        conversationId,
        userId,
        status: ConversationMemberStatus.ACTIVE,
      },
      data: { lastReadAt },
    });
    return { conversationId, lastReadAt };
  }

  async assertAuthenticatedUser(userId: string) {
    await this.ensureActiveUser(userId);
  }

  async assertConversationAccess(userId: string, conversationId: string) {
    await this.requireConversationMember(userId, conversationId);
  }

  private async notifyMessageRecipients(
    senderId: string,
    message: ReturnType<MessagingService['toMessage']>,
  ): Promise<void> {
    if (!this.notifications) return;
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: message.conversationId },
      select: {
        businessId: true,
        members: {
          where: { status: ConversationMemberStatus.ACTIVE },
          select: { userId: true, role: true },
        },
      },
    });
    if (!conversation) return;
    const activeBusinessMembers = await this.prisma.businessMember.findMany({
      where: {
        businessId: conversation.businessId,
        status: BusinessMemberStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE },
      },
      select: { userId: true },
    });
    const activeBusinessUserIds = new Set(
      activeBusinessMembers.map((member) => member.userId),
    );
    const travelerRecipientIds = conversation.members
      .filter(
        (member) =>
          member.role === ConversationMemberRole.TRAVELER &&
          member.userId !== senderId,
      )
      .map((member) => member.userId);
    const businessRecipientIds = [...activeBusinessUserIds].filter(
      (userId) => userId !== senderId,
    );
    const recipients = [
      ...new Set([...travelerRecipientIds, ...businessRecipientIds]),
    ];
    await this.notifications.createForUsers(recipients, {
      actorUserId: senderId,
      type: NotificationType.MESSAGE_RECEIVED,
      title: 'New message',
      body: 'You received a new message.',
      actionUrl: `/messages/${message.conversationId}`,
      dedupePrefix: `message-received:${message.id}`,
    });
  }
  private async requireConversationMember(
    userId: string,
    conversationId: string,
  ) {
    await this.ensureActiveUser(userId);
    const member = await this.prisma.conversationMember.findFirst({
      where: {
        conversationId,
        userId,
        status: ConversationMemberStatus.ACTIVE,
      },
      select: {
        id: true,
        role: true,
        conversation: { select: { businessId: true } },
      },
    });
    if (!member) throw new NotFoundException('Conversation not found.');
    if (member.role === ConversationMemberRole.BUSINESS_MEMBER) {
      const membership = await this.findBusinessMembership(
        userId,
        member.conversation.businessId,
      );
      if (!membership) throw new NotFoundException('Conversation not found.');
    }
  }

  private async ensureActiveUser(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    if (!user) throw new UnauthorizedException('Authentication required.');
  }

  private async findBusinessMembership(userId: string, businessId: string) {
    return this.prisma.businessMember.findFirst({
      where: {
        userId,
        businessId,
        status: BusinessMemberStatus.ACTIVE,
        role: { in: businessConversationRoles },
      },
      select: { id: true },
    });
  }

  private async ensurePublicBusiness(businessId: string) {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, ...publicBusinessWhere() },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('Business not found.');
  }

  private async activeBusinessMembers(businessId: string) {
    return this.prisma.businessMember.findMany({
      where: {
        businessId,
        status: BusinessMemberStatus.ACTIVE,
        role: { in: businessConversationRoles },
        user: { status: UserStatus.ACTIVE },
      },
      select: { userId: true },
    });
  }

  private searchWhere(q?: string): Prisma.ConversationWhereInput {
    const trimmed = this.trim(q);
    return trimmed
      ? {
          OR: [
            { subject: { contains: trimmed, mode: 'insensitive' } },
            { business: { name: { contains: trimmed, mode: 'insensitive' } } },
            {
              booking: {
                reference: { contains: trimmed, mode: 'insensitive' },
              },
            },
          ],
        }
      : {};
  }

  private toConversation(conversation: ConversationRecord) {
    return {
      id: conversation.id,
      businessId: conversation.businessId,
      bookingId: conversation.bookingId,
      subject: conversation.subject,
      status: conversation.status,
      lastMessageAt: conversation.lastMessageAt,
      archivedAt: conversation.archivedAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      business: conversation.business,
      booking: conversation.booking,
      members: conversation.members.map((member) => ({
        id: member.id,
        role: member.role,
        status: member.status,
        lastReadAt: member.lastReadAt,
        createdAt: member.createdAt,
        displayName: this.displayName(member.user.profile),
      })),
    };
  }

  private async toConversationWithUnread(
    conversation: ConversationRecord,
    userId: string,
  ) {
    const member = conversation.members.find((item) => item.userId === userId);
    const unreadCount = member
      ? await this.prisma.message.count({
          where: {
            conversationId: conversation.id,
            status: MessageStatus.SENT,
            senderId: { not: userId },
            ...(member.lastReadAt
              ? { createdAt: { gt: member.lastReadAt } }
              : {}),
          },
        })
      : 0;
    return { ...this.toConversation(conversation), unreadCount };
  }

  private toMessage(message: MessageRecord) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      body: message.body,
      status: message.status,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      sender: { displayName: this.displayName(message.sender.profile) },
    };
  }

  private displayName(
    profile: { firstName: string | null; lastName: string | null } | null,
  ) {
    const name = [profile?.firstName, profile?.lastName]
      .filter(Boolean)
      .join(' ');
    return name || 'EthioTravel user';
  }

  private trim(value?: string): string | undefined {
    const trimmed = value?.trim();
    return trimmed || undefined;
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
