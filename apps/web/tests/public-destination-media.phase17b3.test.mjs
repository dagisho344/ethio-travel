/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-base-to-string -- Synthetic JSX nodes and VM-loaded TSX exports are checked at runtime. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = join(import.meta.dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const firstId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const image = (id, role = 'GALLERY') => ({
  id,
  role,
  sortOrder: 0,
  mediaType: 'IMAGE',
  mimeType: 'image/png',
  accessPath: `/api/v1/media/public/${id}`,
  altText: null,
  caption: null,
});

/** @param {unknown} node */
function flatten(node) {
  if (node === null || node === undefined || typeof node === 'boolean')
    return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node !== 'object') return [String(node)];
  return [node, ...flatten(node.props?.children)];
}

/** @param {'en'|'am'} locale @param {unknown[]} [state] @param {Array<(value:unknown)=>void>} [setters] @param {Array<{current:unknown}>} [refs] */
function harness(locale, state = [], setters = [], refs = []) {
  const messages = JSON.parse(read(`messages/${locale}.json`)).destinations;
  const effects = [];
  const listeners = new Map();
  let stateIndex = 0;
  let refIndex = 0;
  const compiled = ts.transpileModule(
    read('components/public/PublicDestinationMedia.tsx'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    Set,
    window: {
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: (name) => listeners.delete(name),
      requestAnimationFrame: (callback) => callback(),
    },
    document: { activeElement: null },
    require: (name) => {
      if (name === 'react/jsx-runtime')
        return {
          jsx: (type, props) => ({ type, props }),
          jsxs: (type, props) => ({ type, props }),
        };
      if (name === 'react')
        return {
          useCallback: (callback) => callback,
          useEffect: (effect) => effects.push(effect),
          useRef: (value) => refs[refIndex++] ?? { current: value },
          useState: (value) => {
            const index = stateIndex++;
            return [
              state[index] === undefined
                ? typeof value === 'function'
                  ? value()
                  : value
                : state[index],
              setters[index] ?? (() => {}),
            ];
          },
        };
      if (name === 'next-intl')
        return {
          useTranslations:
            () =>
            (key, values = {}) =>
              String(messages[key] ?? key).replace(/\{(\w+)\}/g, (_, field) =>
                String(values[field] ?? ''),
              ),
        };
      if (name === 'lucide-react')
        return {
          ChevronLeft: 'ChevronLeft',
          ChevronRight: 'ChevronRight',
          ImageIcon: 'ImageIcon',
          X: 'X',
        };
      if (name.endsWith('/lib/public-media'))
        return {
          publicMediaUrl: ({ accessPath }) =>
            `https://api.example.test${accessPath}`,
        };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return { component: exports, effects, listeners, messages };
}

void test('list, homepage and scoped detail consume only existing public Destination media', () => {
  const home = read('app/page.tsx');
  const cards = read('components/cards/TravelCards.tsx');
  const listing = read('app/destinations/page.tsx');
  const detail = read(
    'app/regions/[regionSlug]/cities/[citySlug]/destinations/[destinationSlug]/page.tsx',
  );
  const api = read('../api/src/destinations/public-destination-media.util.ts');
  assert.match(
    home,
    /safeDestinationPage\('\/destinations', locale, \{ limit: 3 \}\)/,
  );
  for (const source of [cards, listing]) {
    assert.match(source, /PublicDestinationThumbnail/);
    assert.match(source, /destination\.media\?\.hero/);
  }
  assert.match(detail, /PublicDestinationHero/);
  assert.match(detail, /PublicDestinationGallery/);
  assert.match(detail, /destination\.media\?\.gallery/);
  assert.match(api, /status: MediaStatus\.READY/);
  assert.match(api, /visibility: MediaVisibility\.PUBLIC/);
  assert.match(api, /take: MAX_PUBLIC_DESTINATION_GALLERY/);
  assert.match(
    api,
    /accessPath: `\/api\/v1\/media\/public\/\$\{item\.media\.id\}`/,
  );
  assert.doesNotMatch(
    cards + listing + detail,
    /storageKey|\/api\/admin\/destinations/,
  );
});

void test('HERO-only, no-image, failed-image and invalid-reference states fall back safely', () => {
  const hero = image(firstId, 'HERO');
  const empty = harness('en');
  assert.equal(empty.component.isPublicDestinationImage(hero, 'HERO'), true);
  assert.equal(
    empty.component.isPublicDestinationImage(
      { ...hero, role: 'GALLERY' },
      'HERO',
    ),
    false,
  );
  assert.equal(
    empty.component.isPublicDestinationImage(
      { ...hero, mediaType: 'VIDEO' },
      'HERO',
    ),
    false,
  );
  assert.equal(
    empty.component.isPublicDestinationImage(
      { ...hero, mimeType: 'image/svg+xml' },
      'HERO',
    ),
    false,
  );
  assert.equal(
    empty.component.isPublicDestinationImage(
      { ...hero, accessPath: '/private/key' },
      'HERO',
    ),
    false,
  );
  assert.equal(
    empty.component.isPublicDestinationImage(
      { ...hero, accessPath: `${hero.accessPath}?token=secret` },
      'HERO',
    ),
    false,
  );
  const emptyThumb = flatten(
    empty.component.PublicDestinationThumbnail({
      destinationName: 'Lalibela',
      hero: null,
    }),
  );
  assert.equal(emptyThumb.filter((node) => node.type === 'img').length, 0);
  const failureUpdates = [];
  const heroThumb = flatten(
    harness(
      'en',
      [false],
      [(value) => failureUpdates.push(value)],
    ).component.PublicDestinationThumbnail({
      destinationName: 'Lalibela',
      hero,
    }),
  );
  const thumbnail = heroThumb.find((node) => node.type === 'img');
  assert.equal(thumbnail.props.loading, 'lazy');
  assert.equal(
    thumbnail.props.src,
    `https://api.example.test${hero.accessPath}`,
  );
  assert.equal(thumbnail.props.alt, 'Cover image of Lalibela');
  thumbnail.props.onError();
  assert.deepEqual(failureUpdates, [true]);
  const failed = flatten(
    harness('en', [true]).component.PublicDestinationThumbnail({
      destinationName: 'Lalibela',
      hero,
    }),
  );
  assert.equal(failed.filter((node) => node.type === 'img').length, 0);
  const gallery = empty.component.PublicDestinationGallery({
    destinationName: 'Lalibela',
    media: [],
  });
  assert.equal(gallery, null);
});

void test('gallery keeps server order and bound, excludes invalid items, and renders original captions', () => {
  for (const locale of ['en', 'am']) {
    const h = harness(locale);
    const rows = [
      { ...image(secondId), sortOrder: 1, caption: 'Original caption' },
      { ...image(firstId), sortOrder: 2, altText: 'Original alt text' },
      { ...image('33333333-3333-4333-8333-333333333333', 'HERO') },
      {
        ...image('44444444-4444-4444-8444-444444444444'),
        accessPath: '/private/path',
      },
    ];
    const nodes = flatten(
      h.component.PublicDestinationGallery({
        destinationName: 'Lalibela',
        media: rows,
      }),
    );
    const images = nodes.filter((node) => node.type === 'img');
    assert.equal(images.length, 2);
    assert.ok(images[0].props.src.endsWith(secondId));
    assert.ok(images[1].props.src.endsWith(firstId));
    assert.equal(images[1].props.alt, 'Original alt text');
    assert.ok(nodes.includes('Original caption'));
    assert.ok(nodes.includes(h.messages.gallery));
    assert.equal(images[0].props.loading, 'lazy');
    const many = Array.from({ length: 13 }, (_, index) =>
      image(`${String(index).padStart(8, '0')}-1111-4111-8111-111111111111`),
    );
    assert.equal(
      flatten(
        h.component.PublicDestinationGallery({
          destinationName: 'Lalibela',
          media: many,
        }),
      ).filter((node) => node.type === 'img').length,
      12,
    );
  }
});

void test('viewer opens, navigates by keyboard, closes with Escape and restores opener focus', () => {
  const selections = [];
  const refs = [{ current: null }, { current: null }, { current: null }];
  const h = harness(
    'en',
    [new Set(), null],
    [() => {}, (value) => selections.push(value)],
    refs,
  );
  const rows = [image(firstId), image(secondId)];
  const gallery = flatten(
    h.component.PublicDestinationGallery({
      destinationName: 'Lalibela',
      media: rows,
    }),
  );
  const trigger = gallery.find((node) => node.type === 'button');
  let restored = 0;
  trigger.props.onClick({ currentTarget: { focus: () => restored++ } });
  assert.equal(selections[0], 0);
  const opened = harness(
    'en',
    [new Set(), 0],
    [() => {}, (value) => selections.push(value)],
    refs,
  );
  const openedTree = flatten(
    opened.component.PublicDestinationGallery({
      destinationName: 'Lalibela',
      media: rows,
    }),
  );
  const dialog = openedTree.find((node) => node.props?.role === 'dialog');
  assert.equal(dialog.props['aria-modal'], 'true');
  opened.effects[0]();
  const handler = opened.listeners.get('keydown');
  let prevented = 0;
  handler({ key: 'ArrowRight', preventDefault: () => prevented++ });
  assert.equal(selections.at(-1)(0), 1);
  handler({ key: 'ArrowLeft', preventDefault: () => prevented++ });
  assert.equal(selections.at(-1)(0), 1);
  handler({ key: 'Escape', preventDefault: () => prevented++ });
  assert.equal(selections.at(-1), null);
  assert.equal(restored, 1);
  assert.equal(prevented, 3);
});

void test('fixed controls are localized without changing editorial metadata or exposing credentials', () => {
  const en = JSON.parse(read('messages/en.json')).destinations;
  const am = JSON.parse(read('messages/am.json')).destinations;
  assert.deepEqual(Object.keys(en).sort(), Object.keys(am).sort());
  for (const key of [
    'gallery',
    'imageViewer',
    'closeImageViewer',
    'previousImage',
    'nextImage',
    'imagePosition',
    'noCoverImage',
  ]) {
    assert.ok(en[key]);
    assert.match(am[key], /[\u1200-\u137f]/);
  }
  const component = read('components/public/PublicDestinationMedia.tsx');
  assert.match(component, /item\.caption/);
  assert.match(component, /item\.altText/);
  assert.match(component, /event\.key === 'Tab'/);
  assert.match(component, /focus-visible:ring/);
  assert.doesNotMatch(
    component,
    /localStorage|sessionStorage|storageKey|refreshToken|accessToken|\/api\/admin\//,
  );
});
