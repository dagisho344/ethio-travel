import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('public business media builds controlled endpoint URLs without duplicating the API version', () => {
  const helper = read('lib/public-media.ts');
  const detail = read(
    'app/regions/[regionSlug]/cities/[citySlug]/businesses/[businessSlug]/page.tsx',
  );

  assert.match(helper, /new URL\(media\.accessPath, publicApiBase\)/);
  assert.match(helper, /startsWith\('\/api\/v1\/media\/public\/'\)/);
  assert.match(detail, /PublicBusinessCover/);
  assert.match(detail, /PublicBusinessLogo/);
  assert.match(detail, /PublicBusinessGallery/);
  assert.doesNotMatch(detail, /publicApiBase/);
  assert.doesNotMatch(detail, /\$\{publicApiBase\}\$\{item\.accessPath\}/);
});

void test('public business cards use real optional hero and logo thumbnails', () => {
  const cards = read('components/cards/TravelCards.tsx');
  const businesses = read('app/businesses/page.tsx');
  const serviceCard = read('components/public/PublicServiceCard.tsx');

  for (const source of [cards, businesses]) {
    assert.match(source, /PublicBusinessCardImage/);
    assert.match(source, /hero=\{business\.media\?\.hero\}/);
    assert.match(source, /logo=\{business\.media\?\.logo\}/);
  }
  assert.match(serviceCard, /PublicBusinessCardImage/);
  assert.doesNotMatch(
    serviceCard,
    /\$\{publicApiBase\}\$\{media\.accessPath\}/,
  );
});

void test('gallery rendering is responsive, lazy, and keyboard-accessible without browser credentials', () => {
  const media = read('components/public/PublicBusinessMedia.tsx');
  const types = read('lib/types.ts');

  assert.match(types, /gallery\?: PublicMedia\[\]/);
  assert.match(media, /loading="lazy"/);
  assert.match(media, /role="dialog"/);
  assert.match(media, /event\.key === 'Escape'/);
  assert.match(media, /onError/);
  assert.match(media, /object-cover/);
  assert.doesNotMatch(
    media,
    /localStorage|sessionStorage|accessToken|refreshToken|storageKey/,
  );
});
