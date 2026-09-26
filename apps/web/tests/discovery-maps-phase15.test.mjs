import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('Search is canonical while Explore and Map remain compatibility redirects', () => {
  const search = read('app/search/page.tsx');
  const explore = read('app/explore/page.tsx');
  const map = read('app/map/page.tsx');
  const layout = read('components/layout/PublicLayout.tsx');

  assert.match(search, /PublicSearchPage/);
  assert.match(
    explore,
    /redirect\(suffix \? `\/search\?\$\{suffix\}` : '\/search'\)/,
  );
  assert.match(explore, /publicSearchParamKeys/);
  assert.match(map, /redirect\('\/search\?view=map'\)/);
  assert.match(layout, /\{ href: '\/search', label: navigation\('search'\) \}/);
  assert.match(
    layout,
    /\{ href: '\/search\?view=map', label: navigation\('map'\) \}/,
  );
});

void test('discovery requests are allowlisted and Nearby coordinates stay ephemeral', () => {
  const helper = read('lib/public-discovery-query.ts');
  const client = read('components/explore/ExploreClient.tsx');

  assert.match(helper, /publicSearchParamKeys/);
  assert.match(helper, /const mapParamKeys/);
  assert.match(helper, /buildSearchRequestParams/);
  assert.match(helper, /buildMapPlacesParams/);
  assert.match(helper, /result\.delete\('view'\)/);
  assert.match(helper, /'pricingModel'/);
  assert.match(helper, /'currency'/);
  assert.match(helper, /result\.set\('lat', String\(nearby\.lat\)\)/);
  assert.match(client, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(client, /setNearby\(/);
  assert.match(
    client,
    /buildMapPlacesParams\(normalizedParams, bounds, nearby\)/,
  );
  assert.match(client, /buildSearchRequestParams\(normalizedParams, nearby\)/);
  assert.match(client, /const searchRequestId = useRef\(0\)/);
  assert.match(client, /requestId === searchRequestId\.current/);
  assert.doesNotMatch(
    client,
    /localStorage|sessionStorage|accessToken|refreshToken/,
  );
});

void test('unified price ranges are explicitly scoped to a pricing model and currency', () => {
  const client = read('components/explore/ExploreClient.tsx');
  const english = read('messages/en.json');

  assert.match(client, /hasPriceContext/);
  assert.match(client, /useTranslations\('discovery'\)/);
  assert.match(client, /t\('pricing'\)/);
  assert.match(client, /t\('currency'\)/);
  assert.match(client, /disabled=\{!hasPriceContext\}/);
  assert.match(client, /t\('priceRangeNotice'\)/);
  assert.match(
    english,
    /"priceRangeNotice": "Price ranges compare services only when both pricing model and currency match\.",/,
  );
});

void test('favorite and review targets use canonical detail routes when those routes exist', () => {
  const favorites = read('app/favorites/FavoritesClient.tsx');
  const reviews = read('app/reviews/ReviewsClient.tsx');

  for (const source of [favorites, reviews]) {
    assert.match(source, /publicBusinessPath/);
    assert.match(source, /publicDestinationPath/);
    assert.match(
      source,
      /`\/services\/\$\{encodeURIComponent\(target\.id\)\}`/,
    );
  }
});
void test('public map uses clustering, canonical detail links, and list/map selection', () => {
  const map = read('components/map/MapView.tsx');
  const client = read('components/explore/ExploreClient.tsx');
  const card = read('components/cards/TravelCards.tsx');

  assert.match(map, /MarkerClusterGroup/);
  assert.match(map, /chunkedLoading/);
  assert.match(map, /publicBusinessPath/);
  assert.match(map, /publicDestinationPath/);
  assert.match(map, /BoundsReporter/);
  assert.match(map, /setTimeout\(/);
  assert.match(client, /selectedPlaceKey/);
  assert.match(client, /onSelectPlace/);
  assert.match(card, /onShowOnMap/);
  assert.doesNotMatch(map, /unpkg\.com/);
});

void test('scoped destination links use public route data instead of identifiers or display names', () => {
  const helper = read('lib/public-destination-route.ts');
  const card = read('components/cards/TravelCards.tsx');

  assert.match(
    helper,
    /regions\/\$\{encodeURIComponent\(destination\.region\.slug\)\}/,
  );
  assert.match(
    helper,
    /cities\/\$\{encodeURIComponent\(destination\.city\.slug\)\}/,
  );
  assert.match(
    helper,
    /destinations\/\$\{encodeURIComponent\(destination\.slug\)\}/,
  );
  assert.match(card, /publicDestinationPath/);
  assert.doesNotMatch(helper, /destination\.id/);
});
