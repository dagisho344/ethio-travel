'use client';

import Link from 'next/link';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
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
import { resolveLocale } from '../../i18n/config';
import { formatLocaleDate, formatLocaleNumber } from '../../i18n/format';

const PAGE_SIZE = 30;

type BrowserSession = {
  authenticated: boolean;
  user: { id: string } | null;
};

function uniqueSorted(messages: Message[]): Message[] {
  const byId = new Map(messages.map((message) => [message.id, message]));
  return [...byId.values()].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}

export function ConversationDetailClient() {
  const t = useTranslations('messaging');
  const locale = resolveLocale(useLocale());
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

  function localizedDisplayTime(value: string): string {
    return formatLocaleDate(value, locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  function localizedConversationContext(conversation: Conversation): string {
    if (conversation.booking) {
      return t('bookingContext', {
        reference: conversation.booking.reference,
        service: conversation.booking.service.name,
      });
    }
    return conversation.subject ?? t('inquiry');
  }

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
        setError(t('unavailable'));
        return true;
      }
      return false;
    },
    [pathname, router, t],
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
        setError(t('loadConversation'));
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
      if (!handleFailure(cause)) setError(t('loadOlder'));
    } finally {
      setLoadingOlder(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) {
      setError(t('writeBeforeSend'));
      return;
    }
    if (body.length > MESSAGE_MAX_LENGTH) {
      setError(
        t('maxLength', {
          count: formatLocaleNumber(MESSAGE_MAX_LENGTH, locale),
        }),
      );
      return;
    }
    if (!conversation || conversation.status !== 'ACTIVE') {
      setError(t('archivedNoSend'));
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
        setError(t('archivedNoLongerSend'));
      } else if (!handleFailure(cause)) {
        setError(t('sendError'));
      }
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        {t('loadingConversation')}
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
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('back')}
        </Link>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          {error ?? t('notFound')}
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
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />{' '}
          {t('allMessages')}
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-950">
              {conversation.business.name}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {localizedConversationContext(conversation)}
            </p>
          </div>
          {archived ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {t('archived')}
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
        aria-label={t('messagesRegion')}
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
            {t('loadOlderMessages')}
          </button>
        ) : null}
        {!messages.length ? (
          <p className="py-12 text-center text-sm text-slate-500">
            {t('emptyConversation')}
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
                {localizedDisplayTime(message.createdAt)}
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
            {t('readOnly')}
          </p>
        ) : (
          <div className="flex items-end gap-3">
            <label className="sr-only" htmlFor="message-body">
              {t('message')}
            </label>
            <textarea
              id="message-body"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={MESSAGE_MAX_LENGTH}
              disabled={sending}
              rows={2}
              placeholder={t('messagePlaceholder')}
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
              {t('send')}
            </button>
          </div>
        )}
        {!archived ? (
          <p className="mt-2 text-right text-xs text-slate-500">
            {formatLocaleNumber(draft.trim().length, locale)} /{' '}
            {formatLocaleNumber(MESSAGE_MAX_LENGTH, locale)}
          </p>
        ) : null}
      </form>
    </div>
  );
}
