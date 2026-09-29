import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('public Destination requests forward only the resolved server locale to the F1 API', () => {
  const helper = read('lib/public-destinations.ts');
  const home = read('app/page.tsx');
  const listing = read('app/destinations/page.tsx');
  const detail = read(
    'app/regions/[regionSlug]/cities/[citySlug]/destinations/[destinationSlug]/page.tsx',
  );

  assert.match(helper, /import type \{ AppLocale \} from '\.\.\/i18n\/config'/);
  assert.match(helper, /return \{ \.\.\.query, locale \};/);
  assert.match(helper, /safePage<Destination>\(path, publicDestinationQuery/);
  assert.match(helper, /getJson<Destination>\(path, publicDestinationQuery/);
  for (const source of [home, listing, detail]) {
    assert.match(source, /getRequestLocale/);
  }
  assert.match(
    home,
    /safeDestinationPage\('\/destinations', locale, \{ limit: 3 \}\)/,
  );
  assert.match(listing, /safeDestinationPage\([\s\S]*locale,/);
  assert.match(
    detail,
    /getPublicDestination\([\s\S]*await getRequestLocale\(\)/,
  );
});

void test('public Destination cards and detail render only the F1-resolved editorial representation', () => {
  const cards = read('components/cards/TravelCards.tsx');
  const listing = read('app/destinations/page.tsx');
  const detail = read(
    'app/regions/[regionSlug]/cities/[citySlug]/destinations/[destinationSlug]/page.tsx',
  );

  for (const source of [cards, listing, detail]) {
    assert.match(source, /destination\.name/);
    assert.match(source, /destination\.shortDescription/);
  }
  assert.match(detail, /destination\.fullDescription/);
  for (const source of [listing, detail]) {
    assert.doesNotMatch(
      source,
      /DestinationTranslation|isPublished|publishedAt|translations\b/,
    );
  }
});

void test('localized detail metadata uses resolved public content without changing canonical routes', () => {
  const detail = read(
    'app/regions/[regionSlug]/cities/[citySlug]/destinations/[destinationSlug]/page.tsx',
  );

  assert.match(detail, /export async function generateMetadata/);
  assert.match(detail, /title: `\$\{destination\.name\} \| EthioTravel`/);
  assert.match(detail, /description: destination\.shortDescription/);
  assert.match(detail, /export const dynamic = 'force-dynamic'/);
  assert.match(detail, /export const revalidate = 0/);
  assert.match(
    detail,
    /\/regions\/\$\{encodeURIComponent\(regionSlug\)\}\/cities/,
  );
  assert.doesNotMatch(detail, /\/en\/|\/am\/|hreflang|alternates/);
});

void test('F4A-2 forwards a server-resolved locale without changing shared-trip fragment handling', () => {
  const search = read('components/explore/PublicSearchPage.tsx');
  const map = read('components/map/MapView.tsx');
  const sharedTrip = read('components/trips/SharedTripClient.tsx');

  assert.match(search, /getRequestLocale/);
  assert.match(search, /safeDestinationPage/);
  assert.match(search, /locale=\{locale\}/);
  assert.doesNotMatch(map, /public-destinations|locale=/);
  assert.match(sharedTrip, /window\.location\.hash\.slice\(1\)/);
  assert.match(sharedTrip, /window\.history\.replaceState/);
  assert.match(sharedTrip, /\/api\/trip-shares\/resolve/);
  assert.doesNotMatch(sharedTrip, /localStorage|sessionStorage/);
});
