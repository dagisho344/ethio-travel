'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  safeNotificationActionUrl,
} from '../../lib/notifications';
import { BffRequestError } from '../../lib/private-api';
import type {
  Notification as InAppNotification,
  NotificationType,
  PaginationMeta,
} from '../../lib/types';
import { useRealtime } from '../realtime/RealtimeProvider';

const PAGE_SIZE = 20;
const types: NotificationType[] = [
  'BOOKING_CREATED',
  'BOOKING_CONFIRMED',
  'BOOKING_REJECTED',
  'BOOKING_CANCELLED',
  'BOOKING_COMPLETED',
  'BOOKING_NO_SHOW',
  'PAYMENT_SUCCEEDED',
  'PAYMENT_FAILED',
  'PAYMENT_REFUNDED',
  'MESSAGE_RECEIVED',
  'BUSINESS_VERIFICATION_APPROVED',
  'BUSINESS_VERIFICATION_REJECTED',
  'REVIEW_PUBLISHED',
  'REVIEW_REJECTED',
  'REVIEW_HIDDEN',
];

function displayTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function typeLabel(type: NotificationType): string {
  return type
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (value) => value.toUpperCase());
}

export function NotificationCenterClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { connectionEpoch, subscribeNotifications } = useRealtime();
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [type, setType] = useState<NotificationType | ''>('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError(null);
      try {
        const response = await getNotifications({
          page,
          limit: PAGE_SIZE,
          unreadOnly: filter === 'unread' ? true : undefined,
          type: type || undefined,
        });
        setItems(response.data);
        setMeta(response.meta);
      } catch (cause) {
        if (cause instanceof BffRequestError && cause.status === 401) {
          router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
          return;
        }
        setError('We could not load notifications right now.');
      } finally {
        setLoading(false);
      }
    },
    [filter, pathname, router, type],
  );

  useEffect(() => {
    void load();
  }, [connectionEpoch, load]);

  useEffect(() => {
    const onFocus = () => void load(meta?.page ?? 1);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load, meta?.page]);

  useEffect(
    () =>
      subscribeNotifications((notification) => {
        if (filter === 'unread' && notification.readAt) return;
        if (type && notification.type !== type) return;
        setItems((current) =>
          current.some((existing) => existing.id === notification.id)
            ? current
            : [notification, ...current].slice(0, PAGE_SIZE),
        );
      }),
    [filter, subscribeNotifications, type],
  );

  async function markRead(item: InAppNotification) {
    if (item.readAt) return;
    try {
      const updated = await markNotificationRead(item.id);
      if (filter === 'unread') {
        setItems((current) =>
          current.filter((existing) => existing.id !== updated.id),
        );
      } else {
        setItems((current) =>
          current.map((existing) =>
            existing.id === updated.id ? updated : existing,
          ),
        );
      }
    } catch {
      setError('We could not mark that notification as read.');
    }
  }

  async function markAllRead() {
    setWorking(true);
    try {
      await markAllNotificationsRead();
      if (filter === 'unread') setItems([]);
      else
        setItems((current) =>
          current.map((item) =>
            item.readAt ? item : { ...item, readAt: new Date().toISOString() },
          ),
        );
    } catch {
      setError('We could not mark all notifications as read.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <label className="text-sm font-semibold text-slate-700">
            Show
            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as 'all' | 'unread')
              }
              className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="all">All notifications</option>
              <option value="unread">Unread only</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Type
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value as NotificationType | '')
              }
              className="ml-2 max-w-48 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">All types</option>
              {types.map((item) => (
                <option key={item} value={item}>
                  {typeLabel(item)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          disabled={working}
          onClick={() => void markAllRead()}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {working ? 'Marking read...' : 'Mark all as read'}
        </button>
      </div>
      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{' '}
          Loading notifications...
        </p>
      ) : null}
      {!loading && !items.length ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
          No matching notifications.
        </p>
      ) : null}
      {!loading && items.length ? (
        <ul className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {items.map((item) => {
            const actionUrl = safeNotificationActionUrl(item.actionUrl);
            return (
              <li
                key={item.id}
                className={
                  item.readAt
                    ? 'border-b border-slate-100 p-5 last:border-0'
                    : 'border-b border-emerald-100 bg-emerald-50/70 p-5 last:border-0'
                }
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    {actionUrl ? (
                      <Link
                        href={actionUrl}
                        onClick={() => void markRead(item)}
                        className="rounded-sm focus:outline-none focus:ring-2 focus:ring-highland"
                      >
                        <h2 className="font-semibold text-slate-950">
                          {item.title}
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                          {item.body}
                        </p>
                      </Link>
                    ) : (
                      <>
                        <h2 className="font-semibold text-slate-950">
                          {item.title}
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                          {item.body}
                        </p>
                      </>
                    )}
                    <p className="mt-3 text-xs text-slate-500">
                      {typeLabel(item.type)} · {displayTime(item.createdAt)}
                    </p>
                  </div>
                  {!item.readAt ? (
                    <button
                      type="button"
                      onClick={() => void markRead(item)}
                      className="shrink-0 text-sm font-semibold text-highland hover:text-highland/80"
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={meta.page <= 1 || loading}
            onClick={() => void load(meta.page - 1)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">
            Page {meta.page} of {meta.totalPages}
          </span>
          <button
            type="button"
            disabled={meta.page >= meta.totalPages || loading}
            onClick={() => void load(meta.page + 1)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
