'use client';

import Link from 'next/link';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import {
  getConversation,
  getMessages,
  markConversationRead,
  MESSAGE_MAX_LENGTH,
  sendMessage,
} from '../../lib/messaging';
import { bffJson, BffRequestError } from '../../lib/private-api';
import type {
  Conversation,
  Message,
  MessageListResponse,
  PaginationMeta,
} from '../../lib/types';
import { useRealtime } from '../realtime/RealtimeProvider';

const PAGE_SIZE = 30;

type BrowserSession = {
  authenticated: boolean;
  user: { id: string } | null;
};

function displayTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function uniqueSorted(messages: Message[]): Message[] {
  const byId = new Map(messages.map((message) => [message.id, message]));
  return [...byId.values()].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}

function conversationContext(conversation: Conversation): string {
  if (conversation.booking) {
    return `Booking ${conversation.booking.reference} · ${conversation.booking.service.name}`;
  }
  return conversation.subject ?? 'Business inquiry';
}

export function ConversationDetailClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const { connectionEpoch, connected, joinConversation, subscribeMessages } =
    useRealtime();
  const userIdRef = useRef<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFailure = useCallback(
    (cause: unknown) => {
      if (cause instanceof BffRequestError && cause.status === 401) {
        router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
        return true;
      }
      if (
        cause instanceof BffRequestError &&
        (cause.status === 403 || cause.status === 404)
      ) {
        setError(
          'This conversation is unavailable or you no longer have access.',
        );
        return true;
      }
      return false;
    },
    [pathname, router],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [details, firstPage, session] = await Promise.all([
        getConversation(conversationId),
        getMessages(conversationId, { page: 1, limit: PAGE_SIZE }),
        bffJson<BrowserSession>('/api/auth/me'),
      ]);
      if (!session.authenticated || !session.user) {
        router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      userIdRef.current = session.user.id;
      const page: MessageListResponse =
        firstPage.meta.totalPages > 1
          ? await getMessages(conversationId, {
              page: firstPage.meta.totalPages,
              limit: PAGE_SIZE,
            })
          : firstPage;
      setConversation(details);
      setMessages(uniqueSorted(page.data));
      setMeta(page.meta);
      await markConversationRead(conversationId);
    } catch (cause) {
      if (!handleFailure(cause)) {
        setError('We could not load this conversation right now.');
      }
    } finally {
      setLoading(false);
    }
  }, [connectionEpoch, conversationId, handleFailure, pathname, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  useEffect(() => {
    if (connected) joinConversation(conversationId);
  }, [connected, conversationId, joinConversation]);

  useEffect(
    () =>
      subscribeMessages((message) => {
        if (message.conversationId !== conversationId) return;
        setMessages((current) => uniqueSorted([...current, message]));
        if (message.sender.id !== userIdRef.current) {
          void markConversationRead(conversationId).catch(() => undefined);
        }
      }),
    [conversationId, subscribeMessages],
  );

  async function loadOlder() {
    if (!meta || meta.page <= 1) return;
    setLoadingOlder(true);
    try {
      const response = await getMessages(conversationId, {
        page: meta.page - 1,
        limit: PAGE_SIZE,
      });
      setMessages((current) => uniqueSorted([...response.data, ...current]));
      setMeta(response.meta);
    } catch (cause) {
      if (!handleFailure(cause)) setError('We could not load older messages.');
    } finally {
      setLoadingOlder(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) {
      setError('Write a message before sending.');
      return;
    }
    if (body.length > MESSAGE_MAX_LENGTH) {
      setError(
        `Messages can be at most ${MESSAGE_MAX_LENGTH.toLocaleString()} characters.`,
      );
      return;
    }
    if (!conversation || conversation.status !== 'ACTIVE') {
      setError('This conversation is archived and cannot receive messages.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const message = await sendMessage(conversationId, body);
      setMessages((current) => uniqueSorted([...current, message]));
      setDraft('');
    } catch (cause) {
      if (cause instanceof BffRequestError && cause.status === 409) {
        setConversation((current) =>
          current ? { ...current, status: 'ARCHIVED' } : current,
        );
        setError('This conversation can no longer receive messages.');
      } else if (!handleFailure(cause)) {
        setError(
          'Your message was not sent. Please check your connection and try again.',
        );
      }
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading conversation...
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="space-y-4">
        <Link
          href="/messages"
          className="inline-flex items-center gap-2 text-sm font-semibold text-highland"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Messages
        </Link>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          {error ?? 'Conversation not found.'}
        </p>
      </div>
    );
  }

  const archived = conversation.status !== 'ACTIVE';

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 px-4 py-4 sm:px-6">
        <Link
          href="/messages"
          className="inline-flex items-center gap-2 text-sm font-semibold text-highland hover:text-highland/80"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All messages
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-950">
              {conversation.business.name}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {conversationContext(conversation)}
            </p>
          </div>
          {archived ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Archived
            </span>
          ) : null}
        </div>
      </header>
      {error ? (
        <p className="mx-4 mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:mx-6">
          {error}
        </p>
      ) : null}
      <section
        aria-label="Messages"
        className="min-h-80 space-y-4 bg-slate-50 p-4 sm:p-6"
      >
        {meta && meta.page > 1 ? (
          <button
            type="button"
            disabled={loadingOlder}
            onClick={() => void loadOlder()}
            className="mx-auto flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loadingOlder ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            Load older messages
          </button>
        ) : null}
        {!messages.length ? (
          <p className="py-12 text-center text-sm text-slate-500">
            No messages yet. Start the conversation below.
          </p>
        ) : null}
        {messages.map((message) => {
          const own = message.sender.id === userIdRef.current;
          return (
            <article
              key={message.id}
              className={
                own
                  ? 'ml-auto max-w-[85%] sm:max-w-[70%]'
                  : 'mr-auto max-w-[85%] sm:max-w-[70%]'
              }
            >
              <div
                className={
                  own
                    ? 'rounded-2xl rounded-br-md bg-highland px-4 py-3 text-white'
                    : 'rounded-2xl rounded-bl-md bg-white px-4 py-3 text-slate-800 shadow-sm ring-1 ring-slate-200'
                }
              >
                {!own ? (
                  <p className="mb-1 text-xs font-semibold text-highland">
                    {message.sender.displayName}
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap break-words text-sm leading-6">
                  {message.body}
                </p>
              </div>
              <p
                className={
                  own
                    ? 'mt-1 text-right text-xs text-slate-500'
                    : 'mt-1 text-xs text-slate-500'
                }
              >
                {displayTime(message.createdAt)}
              </p>
            </article>
          );
        })}
      </section>
      <form
        onSubmit={(event) => void submit(event)}
        className="sticky bottom-0 border-t border-slate-200 bg-white p-4 sm:p-5"
      >
        {archived ? (
          <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
            This archived conversation is read-only.
          </p>
        ) : (
          <div className="flex items-end gap-3">
            <label className="sr-only" htmlFor="message-body">
              Message
            </label>
            <textarea
              id="message-body"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={MESSAGE_MAX_LENGTH}
              disabled={sending}
              rows={2}
              placeholder="Write a message..."
              className="min-h-11 flex-1 resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-highland focus:ring-2 focus:ring-highland/20 disabled:bg-slate-100"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              Send
            </button>
          </div>
        )}
        {!archived ? (
          <p className="mt-2 text-right text-xs text-slate-500">
            {draft.trim().length.toLocaleString()} /{' '}
            {MESSAGE_MAX_LENGTH.toLocaleString()}
          </p>
        ) : null}
      </form>
    </div>
  );
}
