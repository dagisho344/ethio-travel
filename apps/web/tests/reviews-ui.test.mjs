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

void test('reviews BFF routes use same-origin authenticated backend calls', () => {
  const route = read('app/api/reviews/route.ts');
  const patchRoute = read('app/api/reviews/[id]/route.ts');
  assert.match(route, /authenticatedBackendJson/);
  assert.match(route, /validateSameOrigin\(request\)/);
  assert.match(route, /\/users\/me\/reviews/);
  assert.match(route, /\/reviews/);
  assert.match(patchRoute, /method:\s*'PATCH'/);
  assert.match(patchRoute, /validateSameOrigin\(request\)/);
});

void test('reviews UI never stores or exposes browser tokens', () => {
  for (const path of [
    'components/reviews/ReviewForm.tsx',
    'components/reviews/ReviewPanel.tsx',
    'app/reviews/ReviewsClient.tsx',
    'app/api/reviews/route.ts',
    'app/api/reviews/[id]/route.ts',
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /localStorage|sessionStorage/, path);
    assert.doesNotMatch(source, /accessToken|refreshToken/, path);
  }
});

void test('write review redirects unauthenticated users with safe returnTo', () => {
  const source = read('components/reviews/ReviewForm.tsx');
  assert.match(source, /status === 401/);
  assert.match(source, /\/login\?/);
  assert.match(source, /returnTo/);
  assert.match(source, /startsWith\('\/'\)/);
  assert.match(source, /!value\.startsWith\('\/\/'\)/);
});

void test('review form validates rating and supports edit pending behavior', () => {
  const source = read('components/reviews/ReviewForm.tsx');
  assert.match(source, /rating < 1 \|\| rating > 5/);
  assert.match(source, /method:\s*'PATCH'/);
  assert.match(source, /method:\s*'POST'/);
  assert.match(source, /pending moderation/);
  assert.match(source, /moderationNote/);
});

void test('public review panel uses published list and summary endpoints', () => {
  const source = read('components/reviews/ReviewPanel.tsx');
  assert.match(source, /\/api\/reviews\/summary/);
  assert.match(source, /\/api\/reviews\?/);
  assert.match(source, /ratingDistribution/);
  assert.match(source, /Any rating/);
  assert.match(source, /sort/);
  assert.doesNotMatch(source, /moderationNote|moderatedById/);
});

void test('my reviews page is authenticated and filters by status and target type', () => {
  const page = read('app/reviews/page.tsx');
  const client = read('app/reviews/ReviewsClient.tsx');
  assert.match(page, /currentTokens/);
  assert.match(page, /redirect\('\/login\?returnTo=\/reviews'\)/);
  assert.match(client, /status/);
  assert.match(client, /targetType/);
  assert.match(client, /moderationNote/);
  assert.match(client, /mine:\s*'true'/);
});

void test('explore cards hydrate own reviews without per-card requests', () => {
  const explore = read('components/explore/ExploreClient.tsx');
  const cards = read('components/cards/TravelCards.tsx');
  assert.match(explore, /\/api\/reviews\?mine=true&limit=100/);
  assert.match(explore, /buildReviewLookup/);
  assert.match(cards, /<ReviewForm/);
  assert.match(cards, /<ReviewPanel/);
});

void test('authenticated navbar exposes My Reviews link', () => {
  const source = read('components/layout/HeaderNavigation.tsx');
  assert.match(source, /href: '\/reviews'/);
  assert.match(source, /My Reviews/);
});
