import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CreatedMessageEvent, MessagingEvents } from './messaging.events';
import {
  CreatedNotificationEvent,
  NotificationsEvents,
} from '../notifications/notifications.events';
import { MessagingService } from './messaging.service';

interface MessagingSocketData {
  user?: AuthenticatedUser;
}

type MessagingSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  MessagingSocketData
>;

@WebSocketGateway({ namespace: '/messaging', cors: { origin: true } })
export class MessagingGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly messaging: MessagingService,
    events: MessagingEvents,
    notificationsEvents?: NotificationsEvents,
  ) {
    events.onMessageCreated((message) => this.emitMessage(message));
    notificationsEvents?.onNotificationCreated((notification) =>
      this.emitNotification(notification),
    );
  }

  async handleConnection(client: MessagingSocket): Promise<void> {
    try {
      const token = this.token(client);
      if (!token) throw new UnauthorizedException();
      const payload = await this.jwt.verifyAsync<unknown>(token);
      const user = this.authenticatedUser(payload);
      if (!user) throw new UnauthorizedException();
      await this.messaging.assertAuthenticatedUser(user.sub);
      client.data.user = user;
      await client.join(`user:${user.sub}`);
    } catch {
      client.disconnect(true);
    }
  }
  @SubscribeMessage('conversation.join')
  async joinConversation(
    @ConnectedSocket() client: MessagingSocket,
    payload: unknown,
  ) {
    const user = client.data.user;
    const conversationId = this.conversationId(payload);
    if (!user || !conversationId) throw new WsException('Unauthorized.');
    try {
      await this.messaging.assertConversationAccess(user.sub, conversationId);
      await client.join(`conversation:${conversationId}`);
      return { event: 'conversation.joined', data: { conversationId } };
    } catch {
      throw new WsException('Conversation not found.');
    }
  }

  private emitMessage(message: CreatedMessageEvent): void {
    this.server
      ?.to(`conversation:${message.conversationId}`)
      .emit('conversation.message.created', message);
  }

  private emitNotification(notification: CreatedNotificationEvent): void {
    this.server
      ?.to(`user:${notification.recipientUserId}`)
      .emit('notification.created', notification);
  }

  private token(client: MessagingSocket): string | undefined {
    const auth = this.record(client.handshake.auth as unknown);
    const authToken = auth?.token;
    if (typeof authToken === 'string') {
      return this.bearerToken(authToken);
    }
    const header = client.handshake.headers.authorization;
    return typeof header === 'string' ? this.bearerToken(header) : undefined;
  }

  private authenticatedUser(payload: unknown): AuthenticatedUser | undefined {
    const value = this.record(payload);
    const sub = value?.sub;
    const sessionId = value?.sessionId;
    const email = value?.email;
    const roles = value?.roles;
    if (
      typeof sub !== 'string' ||
      !sub.trim() ||
      typeof sessionId !== 'string' ||
      !sessionId.trim() ||
      typeof email !== 'string' ||
      !Array.isArray(roles) ||
      !roles.every((role): role is string => typeof role === 'string')
    ) {
      return undefined;
    }
    return { email, roles, sessionId, sub };
  }

  private record(value: unknown): Record<string, unknown> | undefined {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private bearerToken(value: string): string | undefined {
    const token = value.replace(/^Bearer\s+/i, '').trim();
    return token || undefined;
  }

  private conversationId(payload: unknown): string | undefined {
    if (!payload || typeof payload !== 'object') return undefined;
    const value = (payload as { conversationId?: unknown }).conversationId;
    return typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
      ? value
      : undefined;
  }
}
