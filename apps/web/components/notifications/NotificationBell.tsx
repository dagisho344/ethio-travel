'use client';

import Link from 'next/link';
import { Bell, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  safeNotificationActionUrl,
} from '../../lib/notifications';
import type { Notification as InAppNotification } from '../../lib/types';
import { useRealtime } from '../realtime/RealtimeProvider';

function displayTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function NotificationBell() {
  const { connectionEpoch, subscribeNotifications } = useRealtime();
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [notifications, unread] = await Promise.all([
        getNotifications({ page: 1, limit: 5 }),
        getUnreadNotificationCount(),
      ]);
      setItems(notifications.data);
      setUnreadCount(unread.count);
    } catch {
      setError('Notifications are unavailable right now.');
    } finally {
      setLoading(false);
    }
  }, []);

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
      subscribeNotifications((notification) => {
        setItems((current) => {
          if (current.some((existing) => existing.id === notification.id))
            return current;
          return [notification, ...current].slice(0, 5);
        });
        if (!notification.readAt) setUnreadCount((count) => count + 1);
      }),
    [subscribeNotifications],
  );

  async function markRead(item: InAppNotification) {
    if (item.readAt) return;
    try {
      const updated = await markNotificationRead(item.id);
      setItems((current) =>
        current.map((existing) =>
          existing.id === updated.id ? updated : existing,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch {
      setError('We could not mark that notification as read.');
    }
  }

  async function markAllRead() {
    setWorking(true);
    try {
      await markAllNotificationsRead();
      setItems((current) =>
        current.map((item) =>
          item.readAt ? item : { ...item, readAt: new Date().toISOString() },
        ),
      );
      setUnreadCount(0);
    } catch {
      setError('We could not mark all notifications as read.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <details className="relative">
      <summary
        aria-label="Open notifications"
        className="relative flex cursor-pointer list-none items-center justify-center rounded-md p-2 text-slate-700 hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 [&::-webkit-details-marker]:hidden"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </summary>
      <div className="absolute right-0 z-[1200] mt-3 w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
        <div className="flex items-center justify-between gap-3 px-1 pb-3">
          <p className="font-semibold text-slate-950">Notifications</p>
          <div className="flex items-center gap-3 text-sm">
            {unreadCount ? (
              <button
                type="button"
                disabled={working}
                onClick={() => void markAllRead()}
                className="font-semibold text-highland hover:text-highland/80 disabled:opacity-60"
              >
                Mark all read
              </button>
            ) : null}
            <Link href="/notifications" className="font-semibold text-highland">
              View all
            </Link>
          </div>
        </div>
        {loading ? (
          <p className="flex items-center gap-2 px-1 py-5 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading notifications...
          </p>
        ) : error ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error}
          </p>
        ) : items.length ? (
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {items.map((item) => {
              const actionUrl = safeNotificationActionUrl(item.actionUrl);
              return (
                <li
                  key={item.id}
                  className={
                    item.readAt ? 'px-2 py-3' : 'bg-emerald-50/70 px-2 py-3'
                  }
                >
                  <div className="flex gap-3">
                    <div className="min-w-0 flex-1">
                      {actionUrl ? (
                        <Link
                          href={actionUrl}
                          onClick={() => void markRead(item)}
                          className="block rounded-sm focus:outline-none focus:ring-2 focus:ring-highland"
                        >
                          <p className="text-sm font-semibold text-slate-950">
                            {item.title}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {item.body}
                          </p>
                        </Link>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-slate-950">
                            {item.title}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {item.body}
                          </p>
                        </>
                      )}
                      <p className="mt-2 text-xs text-slate-500">
                        {displayTime(item.createdAt)}
                      </p>
                    </div>
                    {!item.readAt ? (
                      <button
                        type="button"
                        onClick={() => void markRead(item)}
                        className="shrink-0 text-xs font-semibold text-highland hover:text-highland/80"
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-1 py-5 text-sm text-slate-500">
            No notifications yet.
          </p>
        )}
      </div>
    </details>
  );
}
