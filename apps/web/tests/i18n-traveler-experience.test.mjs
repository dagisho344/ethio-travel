import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path @returns {string} */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

/** @typedef {Record<string, unknown>} JsonObject */

/** @param {unknown} value @returns {value is JsonObject} */
function isJsonObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {string} path */
function readJson(path) {
  const parsed = /** @type {unknown} */ (JSON.parse(read(path)));
  if (!isJsonObject(parsed)) throw new Error(`${path} must contain an object`);
  return parsed;
}

/** @param {JsonObject} value @param {string} key */
function requiredObject(value, key) {
  const child = value[key];
  if (!isJsonObject(child)) throw new Error(`Expected object at ${key}`);
  return child;
}

/** @param {JsonObject} value @param {string} key */
function requiredString(value, key) {
  const child = value[key];
  if (typeof child !== 'string') throw new Error(`Expected string at ${key}`);
  return child;
}

void test('traveler localization namespaces have English and Ethiopic Amharic entries', () => {
  const english = readJson('messages/en.json');
  const amharic = readJson('messages/am.json');

  for (const namespace of [
    'auth',
    'accountProfile',
    'favorites',
    'travelerReviews',
    'messaging',
    'notifications',
    'assistant',
  ]) {
    const englishNamespace = requiredObject(english, namespace);
    const amharicNamespace = requiredObject(amharic, namespace);
    assert.deepEqual(
      Object.keys(amharicNamespace).sort(),
      Object.keys(englishNamespace).sort(),
      `Amharic ${namespace} keys`,
    );
  }
  assert.match(
    requiredString(requiredObject(amharic, 'auth'), 'loginTitle'),
    /[\u1200-\u137f]/u,
  );
  assert.match(
    requiredString(requiredObject(amharic, 'accountProfile'), 'title'),
    /[\u1200-\u137f]/u,
  );
  assert.match(
    requiredString(requiredObject(amharic, 'messaging'), 'title'),
    /[\u1200-\u137f]/u,
  );
});

void test('authentication UI localizes fixed chrome while retaining safe authentication routing', () => {
  const source = read('components/auth/AuthForm.tsx');

  assert.match(source, /useTranslations\('auth'\)/);
  assert.match(source, /safeReturnTo/);
  assert.match(source, /returnTo/);
  assert.match(source, /t\('signingIn'\)|t\('creatingAccount'\)/);
  assert.doesNotMatch(
    source,
    /localStorage|sessionStorage|accessToken|refreshToken/,
  );
});

void test('private traveler chrome is localized without translating stored user or notification content', () => {
  const sources = [
    ['app/favorites/FavoritesClient.tsx', 'favorites'],
    ['app/reviews/ReviewsClient.tsx', 'travelerReviews'],
    ['components/reviews/ReviewForm.tsx', 'travelerReviews'],
    ['components/messaging/MessagingInboxClient.tsx', 'messaging'],
    ['components/messaging/ConversationDetailClient.tsx', 'messaging'],
    ['components/notifications/NotificationBell.tsx', 'notifications'],
    ['components/notifications/NotificationCenterClient.tsx', 'notifications'],
    ['components/ai/AiAssistantClient.tsx', 'assistant'],
  ];

  for (const [path, namespace] of sources) {
    assert.match(
      read(path),
      new RegExp(`useTranslations\\('${namespace}'\\)`),
      path,
    );
  }

  assert.match(
    read('components/messaging/ConversationDetailClient.tsx'),
    /\{message\.body\}/,
  );
  assert.match(
    read('components/notifications/NotificationBell.tsx'),
    /\{item\.title\}/,
  );
  assert.match(
    read('components/notifications/NotificationBell.tsx'),
    /\{item\.body\}/,
  );
  assert.match(
    read('components/ai/AiAssistantClient.tsx'),
    /\{message\.content\}/,
  );
  assert.match(
    read('components/reviews/ReviewForm.tsx'),
    /review\.moderationNote/,
  );
});

void test('localized traveler clients keep HttpOnly BFF and private-route safeguards', () => {
  const sources = [
    'components/account/AccountProfileClient.tsx',
    'components/messaging/MessagingInboxClient.tsx',
    'components/messaging/ConversationDetailClient.tsx',
    'components/notifications/NotificationBell.tsx',
    'components/notifications/NotificationCenterClient.tsx',
    'components/ai/AiAssistantClient.tsx',
  ];

  for (const path of sources) {
    assert.doesNotMatch(
      read(path),
      /localStorage|sessionStorage|accessToken|refreshToken/,
      path,
    );
  }
  assert.match(
    read('components/account/AccountProfileClient.tsx'),
    /\/api\/account/,
  );
  assert.match(
    read('components/messaging/MessagingInboxClient.tsx'),
    /returnTo=/,
  );
  assert.match(
    read('components/messaging/ConversationDetailClient.tsx'),
    /returnTo=/,
  );
});

void test('localized dates use the shared Gregorian Intl formatter without changing stored data', () => {
  for (const path of [
    'components/messaging/MessagingInboxClient.tsx',
    'components/messaging/ConversationDetailClient.tsx',
    'components/notifications/NotificationBell.tsx',
    'components/notifications/NotificationCenterClient.tsx',
    'components/ai/AiAssistantClient.tsx',
  ]) {
    const source = read(path);
    assert.match(source, /formatLocaleDate/);
    assert.match(source, /resolveLocale\(useLocale\(\)\)/);
  }
});
