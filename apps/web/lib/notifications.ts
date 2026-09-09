import type {
  Notification,
  NotificationListResponse,
  NotificationType,
  UnreadNotificationCount,
} from './types';
import { bffJson, queryString } from './private-api';

export function getNotifications(
  query: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    type?: NotificationType;
  } = {},
): Promise<NotificationListResponse> {
  return bffJson(`/api/notifications${queryString(query)}`);
}

export function getUnreadNotificationCount(): Promise<UnreadNotificationCount> {
  return bffJson('/api/notifications/unread-count');
}

export function markNotificationRead(id: string): Promise<Notification> {
  return bffJson(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return bffJson('/api/notifications/read-all', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function safeNotificationActionUrl(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  try {
    const url = new URL(value, 'https://ethiotravel.local');
    return url.origin === 'https://ethiotravel.local' ? value : null;
  } catch {
    return null;
  }
}
