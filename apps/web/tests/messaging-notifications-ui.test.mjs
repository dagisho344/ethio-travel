import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import test from 'node:test';

const root = process.cwd();
/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('messaging BFF routes use authenticated server-session forwarding', () => {
  for (const path of [
    'app/api/conversations/route.ts',
    'app/api/conversations/[id]/route.ts',
    'app/api/conversations/[id]/messages/route.ts',
    'app/api/conversations/[id]/read/route.ts',
  ]) {
    const source = read(path);
    assert.match(source, /authenticatedBackendJson/, path);
    assert.doesNotMatch(source, /localStorage|sessionStorage/, path);
  }
  assert.match(read('app/api/conversations/route.ts'), /\/conversations/);
  assert.match(
    read('app/api/conversations/[id]/messages/route.ts'),
    /\/messages/,
  );
});

void test('messaging mutations enforce same-origin checks', () => {
  for (const path of [
    'app/api/conversations/route.ts',
    'app/api/conversations/[id]/messages/route.ts',
    'app/api/conversations/[id]/read/route.ts',
  ]) {
    assert.match(read(path), /validateSameOrigin\(request\)/, path);
  }
});

void test('notification BFF routes protect reads and do not expose session tokens', () => {
  for (const path of [
    'app/api/notifications/[id]/read/route.ts',
    'app/api/notifications/read-all/route.ts',
  ]) {
    const source = read(path);
    assert.match(source, /validateSameOrigin\(request\)/, path);
    assert.match(source, /authenticatedBackendJson/, path);
    assert.doesNotMatch(
      source,
      /localStorage|sessionStorage|accessToken|refreshToken/,
      path,
    );
  }
  assert.match(
    read('app/api/notifications/route.ts'),
    /\/users\/me\/notifications/,
  );
  assert.match(
    read('app/api/notifications/unread-count/route.ts'),
    /unread-count/,
  );
});

void test('inbox presents authoritative unread conversation data and states', () => {
  const source = read('components/messaging/MessagingInboxClient.tsx');
  assert.match(source, /getConversations/);
  assert.match(source, /item\.unreadCount/);
  assert.match(source, /item\.lastMessage\?\.body/);
  assert.match(source, /No conversations yet/);
  assert.match(source, /Load more/);
  assert.match(source, /subscribeMessages/);
});

void test('conversation detail validates plain-text input and handles history/read state', () => {
  const source = read('components/messaging/ConversationDetailClient.tsx');
  assert.match(source, /MESSAGE_MAX_LENGTH/);
  assert.match(source, /draft\.trim\(\)/);
  assert.match(source, /markConversationRead/);
  assert.match(source, /Load older messages/);
  assert.match(source, /message\.sender\.id/);
  assert.match(source, /whitespace-pre-wrap/);
  assert.match(source, /This archived conversation is read-only/);
});

void test('realtime client uses only a short-lived socket ticket and cleans up', () => {
  const source = read('components/realtime/RealtimeProvider.tsx');
  assert.match(source, /\/api\/socket-ticket/);
  assert.match(source, /socketTicket/);
  assert.match(source, /conversation\.message\.created/);
  assert.match(source, /notification\.created/);
  assert.match(source, /socket\.removeAllListeners\(\)/);
  assert.doesNotMatch(
    source,
    /accessToken|refreshToken|localStorage|sessionStorage/,
  );
});

void test('notification UI supports unread state, realtime deduplication, and safe actions', () => {
  for (const path of [
    'components/notifications/NotificationBell.tsx',
    'components/notifications/NotificationCenterClient.tsx',
  ]) {
    const source = read(path);
    assert.match(source, /subscribeNotifications/, path);
    assert.match(source, /markNotificationRead/, path);
    assert.match(source, /markAllNotificationsRead/, path);
    assert.match(source, /safeNotificationActionUrl/, path);
    assert.match(
      source,
      /existing\.id === item\.id|existing\.id === updated\.id/,
      path,
    );
  }
});

void test('authenticated navigation exposes Messages and notification bell', () => {
  const layout = read('components/layout/PublicLayout.tsx');
  const navigation = read('components/layout/HeaderNavigation.tsx');
  assert.match(layout, /href: '\/messages'/);
  assert.match(navigation, /NotificationBell/);
  assert.match(layout, /RealtimeProvider/);
});

void test('traveler entry points create conversations only through the BFF', () => {
  const action = read('components/messaging/StartConversationButton.tsx');
  assert.match(action, /createConversation/);
  assert.match(action, /businessId/);
  assert.match(
    read('app/bookings/[id]/BookingDetailClient.tsx'),
    /StartConversationButton/,
  );
  assert.match(read('app/businesses/page.tsx'), /StartConversationButton/);
});
