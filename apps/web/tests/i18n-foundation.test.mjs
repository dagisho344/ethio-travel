import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

/** @param {string} path */
function readJson(path) {
  return JSON.parse(read(path));
}

/** @param {Record<string, unknown>} value */
function flattenKeys(value, prefix = '') {
  return Object.entries(value)
    .flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return child && typeof child === 'object' && !Array.isArray(child)
        ? flattenKeys(child, path)
        : [path];
    })
    .sort();
}

void test('English is the complete master catalog and Amharic has key parity', () => {
  const english = readJson('messages/en.json');
  const amharic = readJson('messages/am.json');

  assert.deepEqual(flattenKeys(amharic), flattenKeys(english));
  assert.equal(english.navigation.home, 'Home');
  assert.equal(amharic.navigation.home, 'መነሻ');
  assert.match(english.common.items, /plural/);
  assert.match(english.common.selection, /\{language\}/);
  assert.match(amharic.common.selection, /\{language\}/);
});

void test('locale resolution uses English fallback and a server-readable secure cookie', () => {
  const config = read('i18n/config.ts');
  const messages = read('i18n/messages.ts');
  const server = read('i18n/server.ts');

  assert.match(config, /supportedLocales = \['en', 'am'\]/);
  assert.match(config, /defaultLocale: AppLocale = 'en'/);
  assert.match(config, /httpOnly: true/);
  assert.match(config, /sameSite: 'lax'/);
  assert.match(config, /secure: process\.env\.NODE_ENV === 'production'/);
  assert.match(config, /path: '\/'/);
  assert.match(messages, /mergeWithEnglishFallback/);
  assert.match(messages, /if \(locale === defaultLocale\) return en/);
  assert.match(server, /cookies\(\)/);
  assert.match(server, /resolveLocale/);
});

void test('the fixed locale route rejects malformed input and validates same-origin mutations', () => {
  const route = read('app/api/locale/route.ts');

  assert.match(route, /validateSameOrigin\(request\)/);
  assert.match(route, /Object\.keys\(input\)\.length !== 1/);
  assert.match(route, /!\('locale' in input\)/);
  assert.match(route, /isAppLocale\(input\.locale\)/);
  assert.match(
    route,
    /response\.cookies\.set\(localeCookieName, input\.locale, localeCookieOptions\)/,
  );
  assert.doesNotMatch(
    route,
    /accessToken|refreshToken|localStorage|sessionStorage/,
  );
});

void test('language controls refresh the current route without rewriting URLs or browser storage', () => {
  const switcher = read('components/layout/LanguageSwitcher.tsx');
  const layout = read('app/layout.tsx');
  const header = read('components/layout/HeaderNavigation.tsx');

  assert.match(switcher, /router\.refresh\(\)/);
  assert.doesNotMatch(switcher, /router\.(push|replace)\(/);
  assert.doesNotMatch(switcher, /localStorage|sessionStorage/);
  assert.match(switcher, /event\.key !== 'Escape'/);
  assert.match(switcher, /pointerdown/);
  assert.match(header, /mobileLanguageOpen/);
  assert.match(header, /max-h-\[calc\(100dvh-5rem\)\].*overflow-y-auto/);
  assert.match(layout, /<html lang=\{locale\} dir="ltr">/);
  assert.match(layout, /NextIntlClientProvider/);
});

void test('shared-trip fragment handling remains client-only and locale routing adds no redirects', () => {
  const client = read('components/trips/SharedTripClient.tsx');
  const nextConfig = read('next.config.ts');

  assert.match(client, /window\.location\.hash\.slice\(1\)/);
  assert.match(client, /window\.history\.replaceState/);
  assert.doesNotMatch(client, /localStorage|sessionStorage|locale/);
  assert.match(nextConfig, /createNextIntlPlugin\('\.\/i18n\/request\.ts'\)/);
  assert.doesNotMatch(nextConfig, /middleware/);
});
