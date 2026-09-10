import assert from 'node:assert/strict';
import process from 'node:process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('favorites BFF routes use secure server-side authenticated backend calls', () => {
  const route = read('app/api/favorites/route.ts');
  const deleteRoute = read('app/api/favorites/[id]/route.ts');
  assert.match(route, /authenticatedBackendJson/);
  assert.match(route, /validateSameOrigin\(request\)/);
  assert.match(route, /\/users\/me\/favorites/);
  assert.match(route, /\/favorites/);
  assert.match(deleteRoute, /authenticatedBackendJson/);
  assert.match(deleteRoute, /validateSameOrigin\(request\)/);
  assert.match(deleteRoute, /method:\s*'DELETE'/);
});

void test('favorite browser UI never uses localStorage or sessionStorage for tokens', () => {
  for (const path of [
    'components/favorites/FavoriteButton.tsx',
    'app/favorites/FavoritesClient.tsx',
    'app/api/favorites/route.ts',
    'app/api/favorites/[id]/route.ts',
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /localStorage|sessionStorage/, path);
    assert.doesNotMatch(source, /accessToken|refreshToken/, path);
  }
});

void test('unauthenticated favorite interactions route to login with safe returnTo', () => {
  const source = read('components/favorites/FavoriteButton.tsx');
  assert.match(source, /status === 401/);
  assert.match(source, /\/login\?/);
  assert.match(source, /returnTo/);
  assert.match(source, /startsWith\('\/'\)/);
  assert.match(source, /!value\.startsWith\('\/\/'\)/);
});

void test('favorite controls reconcile duplicate and missing-delete responses', () => {
  const source = read('components/favorites/FavoriteButton.tsx');
  assert.match(source, /status === 409/);
  assert.match(source, /reconcileExistingFavorite/);
  assert.match(source, /status === 404/);
  assert.match(source, /setFavoriteId\(null\)/);
});

void test('public cards hydrate initial favorite state without per-card requests', () => {
  for (const path of [
    'app/businesses/page.tsx',
    'app/services/page.tsx',
    'app/destinations/page.tsx',
  ]) {
    const source = read(path);
    assert.match(source, /getInitialFavoriteLookup/);
    assert.match(source, /favoriteLookupKey/);
    assert.match(source, /<FavoriteButton/);
  }
});

void test('my favorites page is authenticated and supports filtering and pagination', () => {
  const page = read('app/favorites/page.tsx');
  const client = read('app/favorites/FavoritesClient.tsx');
  assert.match(page, /currentTokens/);
  assert.match(page, /redirect\('\/login\?returnTo=\/favorites'\)/);
  assert.match(client, /targetType/);
  assert.match(client, /page/);
  assert.match(client, /\/api\/favorites/);
  assert.match(client, /method:\s*'DELETE'/);
});

void test('authenticated navbar exposes Favorites link', () => {
  const source = read('components/layout/HeaderNavigation.tsx');
  assert.match(source, /href: '\/favorites'/);
  assert.match(source, /Favorites/);
});
