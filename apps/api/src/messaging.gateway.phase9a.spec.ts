import { WsException } from '@nestjs/websockets';
import { MessagingGateway } from './messaging/messaging.gateway';

const userId = '11111111-1111-4111-8111-111111111111';
const conversationId = '55555555-5555-4555-8555-555555555555';

function setup() {
  let listener: ((message: unknown) => void) | undefined;
  const jwt = { verifyAsync: jest.fn() };
  const messaging = {
    assertAuthenticatedUser: jest.fn(),
    assertConversationAccess: jest.fn(),
  };
  const events = {
    onMessageCreated: jest.fn((callback: (message: unknown) => void) => {
      listener = callback;
    }),
  };
  const gateway = new MessagingGateway(
    jwt as never,
    messaging as never,
    events as never,
  );
  const socket = {
    data: {} as { user?: Record<string, unknown> },
    disconnect: jest.fn(),
    handshake: { auth: {}, headers: {} },
    join: jest.fn(),
  };
  return {
    events,
    gateway,
    jwt,
    listener: () => listener,
    messaging,
    socket,
  };
}

describe('MessagingGateway', () => {
  it('authenticates a socket from the existing access JWT and joins only its own user room', async () => {
    const { gateway, jwt, messaging, socket } = setup();
    socket.handshake.auth = { token: 'Bearer signed-access-token' };
    jwt.verifyAsync.mockResolvedValue({
      email: 'traveler@example.com',
      roles: [],
      sessionId: 'session-id',
      sub: userId,
    });

    await gateway.handleConnection(socket as never);

    expect(messaging.assertAuthenticatedUser).toHaveBeenCalledWith(userId);
    expect(socket.join).toHaveBeenCalledWith(`user:${userId}`);
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('authenticates a server-minted socket ticket', async () => {
    const { gateway, jwt, messaging, socket } = setup();
    socket.handshake.auth = { socketTicket: 'signed-socket-ticket' };
    jwt.verifyAsync.mockResolvedValue({
      email: 'traveler@example.com',
      roles: [],
      sessionId: 'session-id',
      sub: userId,
      tokenUse: 'socket',
    });

    await gateway.handleConnection(socket as never);

    expect(messaging.assertAuthenticatedUser).toHaveBeenCalledWith(userId);
    expect(socket.join).toHaveBeenCalledWith(`user:${userId}`);
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('rejects an access-token-shaped payload presented as a socket ticket', async () => {
    const { gateway, jwt, socket } = setup();
    socket.handshake.auth = { socketTicket: 'signed-access-token' };
    jwt.verifyAsync.mockResolvedValue({
      email: 'traveler@example.com',
      roles: [],
      sessionId: 'session-id',
      sub: userId,
    });

    await gateway.handleConnection(socket as never);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it.each([undefined, 'not-a-valid-token'])(
    'rejects a missing, malformed, or invalid token',
    async (token) => {
      const { gateway, jwt, socket } = setup();
      socket.handshake.auth = token ? { token } : {};
      if (token) jwt.verifyAsync.mockRejectedValue(new Error('invalid token'));

      await gateway.handleConnection(socket as never);

      expect(socket.disconnect).toHaveBeenCalledWith(true);
    },
  );

  it('allows an authorized traveler or active business member to join its conversation room', async () => {
    const { gateway, messaging, socket } = setup();
    socket.data.user = {
      email: 'member@example.com',
      roles: [],
      sessionId: 'session-id',
      sub: userId,
    };

    const result = await gateway.joinConversation(socket as never, {
      conversationId,
    });

    expect(messaging.assertConversationAccess).toHaveBeenCalledWith(
      userId,
      conversationId,
    );
    expect(socket.join).toHaveBeenCalledWith(`conversation:${conversationId}`);
    expect(result).toEqual({
      event: 'conversation.joined',
      data: { conversationId },
    });
  });

  it('denies unrelated travelers, unrelated business members, and inactive members', async () => {
    const { gateway, messaging, socket } = setup();
    socket.data.user = {
      email: 'unrelated@example.com',
      roles: [],
      sessionId: 'session-id',
      sub: userId,
    };
    messaging.assertConversationAccess.mockRejectedValue(
      new Error('no active membership'),
    );

    await expect(
      gateway.joinConversation(socket as never, { conversationId }),
    ).rejects.toBeInstanceOf(WsException);
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('rejects arbitrary conversation-room payloads without checking client claims', async () => {
    const { gateway, messaging, socket } = setup();
    socket.data.user = {
      email: 'traveler@example.com',
      roles: [],
      sessionId: 'session-id',
      sub: userId,
    };

    await expect(
      gateway.joinConversation(socket as never, {
        conversationId: 'not-a-uuid',
        userId: 'attacker-controlled',
      }),
    ).rejects.toBeInstanceOf(WsException);
    expect(messaging.assertConversationAccess).not.toHaveBeenCalled();
  });

  it('broadcasts persisted message events only to the authorized conversation room', () => {
    const { gateway, listener } = setup();
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    gateway.server = { to } as never;
    const message = {
      body: 'Hello',
      conversationId,
      createdAt: new Date(),
      id: '66666666-6666-4666-8666-666666666666',
      sender: { displayName: 'Traveler' },
      status: 'SENT',
      updatedAt: new Date(),
    };

    listener()?.(message);

    expect(to).toHaveBeenCalledWith(`conversation:${conversationId}`);
    expect(emit).toHaveBeenCalledWith('conversation.message.created', message);
  });
});
