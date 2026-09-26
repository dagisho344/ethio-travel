import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('public marketplace chrome uses the shared English and Amharic catalogs', () => {
  const english = read('messages/en.json');
  const amharic = read('messages/am.json');
  const home = read('app/page.tsx');
  const search = read('components/explore/ExploreClient.tsx');
  const map = read('components/map/MapView.tsx');
  const serviceDetails = read('components/public/ServiceCategoryDetails.tsx');
  const loadingStates = [
    read('app/destinations/loading.tsx'),
    read('app/businesses/loading.tsx'),
    read('app/services/loading.tsx'),
  ];

  for (const source of [home, search, map]) {
    assert.match(source, /(?:getTranslations|useTranslations)\('/);
  }
  assert.match(serviceDetails, /useTranslations\('serviceDetails'\)/);
  assert.match(english, /"priceRangeNotice"/);
  assert.match(amharic, /"priceRangeNotice"/);
  assert.match(amharic, /"title": "ኢትዮጵያን ይፈልጉ"/);
  for (const source of loadingStates) {
    assert.match(source, /getTranslations\(/);
  }
});

void test('translated labels do not localize canonical routes, filters, or family values', () => {
  const search = read('components/explore/ExploreClient.tsx');
  const filters = read('lib/public-discovery-query.ts');
  const categoryPage = read('components/public/CategoryMarketplacePage.tsx');
  const categoryResolver = read('lib/public-service-category.ts');

  assert.match(search, /`\/search\?\$\{query\}`/);
  for (const key of [
    'regionSlug',
    'citySlug',
    'destinationSlug',
    'pricingModel',
    'currency',
  ]) {
    assert.match(filters, new RegExp(`'${key}'`));
  }
  assert.match(categoryPage, /safePage<Service>\('\/services', \{/);
  assert.match(categoryPage, /family,/);
  assert.match(categoryResolver, /case 'ACCOMMODATION'/);
  assert.match(categoryResolver, /case 'RESTAURANT'/);
  assert.doesNotMatch(categoryResolver, /ROOM|MEAL|TRANSFER/);
});

void test('public content and detail routes remain canonical while only interface labels translate', () => {
  const business = read(
    'app/regions/[regionSlug]/cities/[citySlug]/businesses/[businessSlug]/page.tsx',
  );
  const destination = read(
    'app/regions/[regionSlug]/cities/[citySlug]/destinations/[destinationSlug]/page.tsx',
  );
  const service = read('app/services/[id]/page.tsx');
  const details = read('components/public/ServiceCategoryDetails.tsx');

  assert.match(business, /business\.name/);
  assert.match(destination, /destination\.name/);
  assert.match(service, /service\.name/);
  assert.match(service, /`\/services\/\$\{id\}`/);
  assert.match(details, /calendar: 'gregory'/);
  assert.doesNotMatch(
    details,
    /toNumber\(|parseFloat|Number\(.*(?:price|fare)/i,
  );
});
