'use client';

import Link from 'next/link';
import { Loader2, MessageCircleMore } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getConversations } from '../../lib/messaging';
import { BffRequestError } from '../../lib/private-api';
import type { ConversationListItem, PaginationMeta } from '../../lib/types';
import { useRealtime } from '../realtime/RealtimeProvider';

const PAGE_SIZE = 20;

function displayTime(value: string | null): string {
  if (!value) return 'No messages yet';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function conversationContext(item: ConversationListItem): string {
  if (item.booking)
    return `Booking ${item.booking.reference} · ${item.booking.service.name}`;
  return item.subject ?? item.business.name;
}

export function MessagingInboxClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { connectionEpoch, subscribeMessages } = useRealtime();
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (page = 1, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const response = await getConversations({ page, limit: PAGE_SIZE });
        setMeta(response.meta);
        setItems((current) => {
          if (!append) return response.data;
          const known = new Set(current.map((item) => item.id));
          return [
            ...current,
            ...response.data.filter((item) => !known.has(item.id)),
          ];
        });
      } catch (cause) {
        if (cause instanceof BffRequestError && cause.status === 401) {
          router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
          return;
        }
        setError('We could not load your conversations right now.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [pathname, router],
  );

  useEffect(() => {
    void load();
  }, [connectionEpoch, load]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  useEffect(
    () =>
      subscribeMessages(() => {
        void load();
      }),
    [load, subscribeMessages],
  );

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading conversations...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          {error}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
        <MessageCircleMore
          className="mx-auto h-10 w-10 text-highland"
          aria-hidden="true"
        />
        <h2 className="mt-4 text-lg font-bold text-slate-950">
          No conversations yet
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
          Contact a verified business or open a booking to start a secure
          conversation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {meta?.total ?? items.length} conversation
        {(meta?.total ?? items.length) === 1 ? '' : 's'}
      </p>
      <ul className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {items.map((item) => (
          <li key={item.id} className="border-b border-slate-100 last:border-0">
            <Link
              href={`/messages/${item.id}`}
              className="block p-4 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-highland sm:p-5"
            >
              <div className="flex items-start gap-3">
                <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-highland">
                  <MessageCircleMore className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div>
                      <h2 className="font-semibold text-slate-950">
                        {item.business.name}
                      </h2>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {conversationContext(item)}
                      </p>
                    </div>
                    <time className="shrink-0 text-xs text-slate-500">
                      {displayTime(
                        item.lastMessageAt ??
                          item.lastMessage?.createdAt ??
                          null,
                      )}
                    </time>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm text-slate-600">
                      {item.lastMessage?.body ?? 'No messages yet'}
                    </p>
                    {item.unreadCount ? (
                      <span className="min-w-5 rounded-full bg-highland px-1.5 text-center text-xs font-bold leading-5 text-white">
                        {item.unreadCount > 99 ? '99+' : item.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {meta && meta.page < meta.totalPages ? (
        <button
          type="button"
          disabled={loadingMore}
          onClick={() => void load(meta.page + 1, true)}
          className="mx-auto flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingMore ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          Load more
        </button>
      ) : null}
    </div>
  );
}
