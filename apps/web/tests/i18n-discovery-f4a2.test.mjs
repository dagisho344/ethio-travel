import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = join(import.meta.dirname, '..');

/** @param {string} path @param {(module:string)=>unknown} imports @param {string} extra */
function execute(path, imports, extra = '') {
  const source = readFileSync(join(root, path), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  /** @type {Record<string,unknown>} */ const exports = {};
  vm.runInNewContext(`${compiled}\n${extra}`, {
    exports,
    require: imports,
    process,
  });
  return exports;
}

/** @param {unknown} node @param {string} type @returns {{type?:string,props?:{children?:unknown}}|null} */
function findElement(node, type) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of /** @type {unknown[]} */ (node)) {
      const found = findElement(item, type);
      if (found) return found;
    }
    return null;
  }
  const element = /** @type {{type?:string,props?:{children?:unknown}}} */ (
    node
  );
  return element.type === type
    ? element
    : findElement(element.props?.children, type);
}

const config = execute('i18n/config.ts', () => ({}));
/** @type {string|undefined} */ let cookieValue;
const server = execute('i18n/server.ts', (name) => {
  if (name === 'next/headers')
    return {
      cookies: () =>
        Promise.resolve({
          get: () =>
            cookieValue === undefined ? undefined : { value: cookieValue },
        }),
    };
  if (name === './config') return config;
  throw new Error(`Unexpected module ${name}`);
});

void test('actual server locale resolution allows en/am and falls back for missing or invalid cookies', async () => {
  for (const [cookie, expected] of [
    ['en', 'en'],
    ['am', 'am'],
    [undefined, 'en'],
    ['fr', 'en'],
  ]) {
    cookieValue = cookie;
    assert.equal(await server.getRequestLocale(), expected);
  }
});

void test('Search server boundary forwards locale to resolved Destination options while retaining canonical slugs', async () => {
  /** @type {Array<{path:string,locale:string,query:unknown}>} */ const calls =
    [];
  /** @type {string} */ let resolvedName = 'Lalibela';
  const page = execute('components/explore/PublicSearchPage.tsx', (name) => {
    if (name === 'react') return { Suspense: 'Suspense' };
    if (name === 'next-intl/server')
      return {
        getTranslations: () =>
          Promise.resolve((/** @type {string} */ key) => key),
      };
    if (name === './ExploreClient') return { ExploreClient: 'ExploreClient' };
    if (name === '../ui/Container') return { Container: 'Container' };
    if (name === '../ui/States') return { SectionHeading: 'SectionHeading' };
    if (name === '../../lib/api')
      return {
        safePage: (/** @type {string} */ path) =>
          Promise.resolve({
            data:
              path === '/regions'
                ? [{ name: 'South', slug: 'south' }]
                : path === '/regions/south/cities'
                  ? [{ name: 'Sodo', slug: 'sodo' }]
                  : [],
          }),
      };
    if (name === '../../lib/public-destinations')
      return {
        safeDestinationPage: (
          /** @type {string} */ path,
          /** @type {string} */ locale,
          /** @type {unknown} */ query,
        ) => {
          calls.push({ path, locale, query });
          return Promise.resolve({
            data: [{ name: resolvedName, slug: 'lalibela' }],
          });
        },
      };
    if (name === '../../i18n/server') return server;
    if (name === 'react/jsx-runtime') {
      const jsx = (
        /** @type {string} */ type,
        /** @type {unknown} */ props,
      ) => ({ type, props });
      return { jsx, jsxs: jsx };
    }
    throw new Error(`Unexpected module ${name}`);
  });
  const render =
    /** @type {(props:{searchParams:Promise<Record<string,string>>})=>Promise<unknown>} */ (
      page.PublicSearchPage
    );
  for (const [cookie, expectedLocale, expectedName] of [
    ['en', 'en', 'Lalibela'],
    ['am', 'am', 'ላሊበላ'],
    [undefined, 'en', 'Lalibela'],
    ['fr', 'en', 'Lalibela'],
  ]) {
    cookieValue = cookie;
    resolvedName = expectedName;
    const tree = await render({
      searchParams: Promise.resolve({
        regionSlug: 'south',
        citySlug: 'sodo',
        destinationSlug: 'lalibela',
        q: 'lake',
        view: 'map',
      }),
    });
    const client = findElement(tree, 'ExploreClient');
    assert.ok(client);
    const props =
      /** @type {{locale:string,destinations:Array<{name:string,slug:string}>,normalizedDestinationSlug:string}} */ (
        client.props
      );
    assert.equal(props.locale, expectedLocale);
    assert.equal(props.destinations[0].name, expectedName);
    assert.equal(props.destinations[0].slug, 'lalibela');
    assert.equal(props.normalizedDestinationSlug, 'lalibela');
    const call = calls.at(-1);
    assert.ok(call);
    assert.equal(call.path, '/regions/south/cities/sodo/destinations');
    assert.equal(call.locale, expectedLocale);
    assert.equal(/** @type {{limit:number}} */ (call.query).limit, 100);
  }
});

/** @param {unknown} node @returns {string} */
function textContent(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node))
    return /** @type {unknown[]} */ (node).map(textContent).join(' ');
  if (!node || typeof node !== 'object') return '';
  return textContent(
    /** @type {{props?:{children?:unknown}}} */ (node).props?.children,
  );
}

void test('actual Destination cards and map popups render resolved English, Amharic and fallback content with canonical links', () => {
  const destinationRoutes = execute(
    'lib/public-destination-route.ts',
    () => ({}),
  );
  const businessRoutes = execute('lib/public-business-route.ts', () => ({}));
  /** @param {string} name @returns {unknown} */
  function imports(name) {
    if (name === 'next-intl')
      return { useTranslations: () => (/** @type {string} */ key) => key };
    if (name === 'react/jsx-runtime') {
      const jsx = (
        /** @type {unknown} */ type,
        /** @type {unknown} */ props,
      ) => ({ type, props });
      return { jsx, jsxs: jsx };
    }
    if (name === 'next/link') return { default: 'Link', __esModule: true };
    if (name === 'react-leaflet') return { Popup: 'Popup' };
    if (name === 'leaflet') return { divIcon: () => ({}) };
    if (name === '../../lib/public-destination-route') return destinationRoutes;
    if (name === '../../lib/public-business-route') return businessRoutes;
    if (name === '../../lib/favorite-utils')
      return { favoriteLookupKey: () => 'DESTINATION:destination-id' };
    return {};
  }
  const cards = execute('components/cards/TravelCards.tsx', imports);
  const map = execute(
    'components/map/MapView.tsx',
    imports,
    'exports.testMarkerPopup = MarkerPopup;',
  );
  const renderCard = /** @type {(props:{result:unknown})=>unknown} */ (
    cards.SearchResultCard
  );
  const renderPopup = /** @type {(props:{place:unknown})=>unknown} */ (
    map.testMarkerPopup
  );
  const canonical = {
    type: 'destination',
    id: 'destination-id',
    slug: 'canonical-slug',
    location: {
      city: { name: 'Canonical City', slug: 'city-slug' },
      region: { name: 'Canonical Region', slug: 'region-slug' },
    },
    latitude: '6.1',
    longitude: '37.1',
  };
  // These are resolved public API fixtures, not translation rows. The web
  // must render an English fallback as-is, without deciding publication.
  for (const editorial of [
    { name: 'Canonical English', shortDescription: 'English prose' },
    { name: 'የአማርኛ መዳረሻ', shortDescription: 'የአማርኛ መግለጫ' },
    { name: 'Canonical fallback', shortDescription: 'Complete fallback prose' },
  ]) {
    const result = { ...canonical, ...editorial };
    const before = JSON.stringify(result);
    const card = renderCard({ result });
    const popup = renderPopup({ place: result });
    assert.ok(textContent(card).includes(editorial.name));
    assert.ok(textContent(card).includes(editorial.shortDescription));
    assert.ok(textContent(popup).includes(editorial.name));
    for (const tree of [card, popup]) {
      const link = findElement(tree, 'Link');
      assert.ok(link);
      const props = /** @type {{href:string}} */ (link.props);
      assert.equal(
        props.href,
        '/regions/region-slug/cities/city-slug/destinations/canonical-slug',
      );
    }
    assert.equal(JSON.stringify(result), before);
  }
});

void test('cards and map popups display resolved API values without translation-row access or locale URLs', () => {
  const card = readFileSync(
    join(root, 'components/cards/TravelCards.tsx'),
    'utf8',
  );
  const map = readFileSync(join(root, 'components/map/MapView.tsx'), 'utf8');
  const client = readFileSync(
    join(root, 'components/explore/ExploreClient.tsx'),
    'utf8',
  );
  const switcher = readFileSync(
    join(root, 'components/layout/LanguageSwitcher.tsx'),
    'utf8',
  );
  assert.match(card, /\{result\.name\}/);
  assert.match(card, /\{result\.shortDescription\}/);
  assert.match(map, /\{place\.name\}/);
  assert.match(map, /publicDestinationPath/);
  assert.match(
    client,
    /buildSearchRequestParams\(normalizedParams, locale, nearby\)/,
  );
  assert.match(switcher, /router\.refresh\(\)/);
  for (const source of [card, map, client]) {
    assert.doesNotMatch(
      source,
      /DestinationTranslation|isPublished|publishedAt|document\.cookie|\/am\/search|\/en\/search/,
    );
  }
});
