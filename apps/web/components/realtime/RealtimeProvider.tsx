'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  RealtimeMessageEvent,
  RealtimeNotificationEvent,
  SocketTicketResponse,
} from '../../lib/types';

interface RealtimeContextValue {
  connectionEpoch: number;
  connected: boolean;
  joinConversation: (conversationId: string) => void;
  subscribeMessages: (
    listener: (message: RealtimeMessageEvent) => void,
  ) => () => void;
  subscribeNotifications: (
    listener: (notification: RealtimeNotificationEvent) => void,
  ) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

function messagingSocketUrl(): string {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
  return `${new URL(apiUrl).origin}/messaging`;
}

async function socketTicket(): Promise<string> {
  const response = await fetch('/api/socket-ticket', { method: 'POST' });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok || !body || typeof body !== 'object') {
    throw new Error('Socket authentication is unavailable.');
  }
  const ticket = (body as Partial<SocketTicketResponse>).socketTicket;
  if (typeof ticket !== 'string' || !ticket.trim()) {
    throw new Error('Socket authentication is unavailable.');
  }
  return ticket;
}

export function RealtimeProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  const socketRef = useRef<Socket | null>(null);
  const messageListeners = useRef(
    new Set<(message: RealtimeMessageEvent) => void>(),
  );
  const notificationListeners = useRef(
    new Set<(notification: RealtimeNotificationEvent) => void>(),
  );
  const [connected, setConnected] = useState(false);
  const [connectionEpoch, setConnectionEpoch] = useState(0);

  const joinConversation = useCallback((conversationId: string) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    socket.emit('conversation.join', { conversationId });
  }, []);

  const subscribeMessages = useCallback(
    (listener: (message: RealtimeMessageEvent) => void) => {
      messageListeners.current.add(listener);
      return () => messageListeners.current.delete(listener);
    },
    [],
  );

  const subscribeNotifications = useCallback(
    (listener: (notification: RealtimeNotificationEvent) => void) => {
      notificationListeners.current.add(listener);
      return () => notificationListeners.current.delete(listener);
    },
    [],
  );

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryAttempt = 0;
    const socket: Socket = io(messagingSocketUrl(), {
      autoConnect: false,
      reconnection: false,
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    const scheduleReconnect = () => {
      if (disposed || retryTimer) return;
      const delay = Math.min(30_000, 1_000 * 2 ** retryAttempt);
      retryAttempt += 1;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        void connect();
      }, delay);
    };

    const connect = async () => {
      try {
        const ticket = await socketTicket();
        if (disposed) return;
        socket.auth = { socketTicket: ticket };
        socket.connect();
      } catch {
        scheduleReconnect();
      }
    };

    socketRef.current = socket;
    socket.on('connect', () => {
      retryAttempt = 0;
      setConnected(true);
      setConnectionEpoch((value) => value + 1);
    });
    socket.on('disconnect', () => {
      setConnected(false);
      scheduleReconnect();
    });
    socket.on('connect_error', () => {
      setConnected(false);
      socket.disconnect();
      scheduleReconnect();
    });
    socket.on(
      'conversation.message.created',
      (message: RealtimeMessageEvent) => {
        messageListeners.current.forEach((listener) => listener(message));
      },
    );
    socket.on(
      'notification.created',
      (notification: RealtimeNotificationEvent) => {
        notificationListeners.current.forEach((listener) =>
          listener(notification),
        );
      },
    );

    void connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [enabled]);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      connected,
      connectionEpoch,
      joinConversation,
      subscribeMessages,
      subscribeNotifications,
    }),
    [
      connected,
      connectionEpoch,
      joinConversation,
      subscribeMessages,
      subscribeNotifications,
    ],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const value = useContext(RealtimeContext);
  if (!value)
    throw new Error('useRealtime must be used within RealtimeProvider.');
  return value;
}
