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
import { Server, Socket } from 'socket.io';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CreatedMessageEvent, MessagingEvents } from './messaging.events';
import { MessagingService } from './messaging.service';

type SocketWithUser = Socket & { data: { user?: AuthenticatedUser } };

@WebSocketGateway({ namespace: '/messaging', cors: { origin: true } })
export class MessagingGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly messaging: MessagingService,
    events: MessagingEvents,
  ) {
    events.onMessageCreated((message) => this.emitMessage(message));
  }

  async handleConnection(client: SocketWithUser): Promise<void> {
    try {
      const token = this.token(client);
      if (!token) throw new UnauthorizedException();
      const user = await this.jwt.verifyAsync<AuthenticatedUser>(token);
      if (!user.sub || !user.sessionId) throw new UnauthorizedException();
      await this.messaging.assertAuthenticatedUser(user.sub);
      client.data.user = user;
      await client.join(`user:${user.sub}`);
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('conversation.join')
  async joinConversation(
    @ConnectedSocket() client: SocketWithUser,
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

  private token(client: Socket): string | undefined {
    const authToken = client.handshake.auth.token;
    if (typeof authToken === 'string')
      return authToken.replace(/^Bearer\s+/i, '');
    const header = client.handshake.headers.authorization;
    return typeof header === 'string'
      ? header.replace(/^Bearer\s+/i, '')
      : undefined;
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
