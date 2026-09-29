import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = join(import.meta.dirname, '..');
/** @typedef {{north:number,south:number,east:number,west:number}} Bounds */
/** @typedef {{requestKey:string,onBoundsChange:(bounds:Bounds)=>void}} BoundsProps */
/** @typedef {{kind:'ref',current:unknown}|{kind:'effect',dependencies:unknown[],cleanup:void|(()=>void)}|{kind:'state',value:unknown}} Slot */

// Execute actual TS component effects using the already-installed TypeScript
// compiler and deterministic hook/timer adapters. No new framework or
// production-only testing exports are needed.
function hookHarness() {
  /** @type {Slot[]} */ const slots = [];
  let cursor = 0;
  /** @type {Array<()=>void>} */ let effects = [];
  const hooks = {
    /** @param {unknown} value */
    useRef(value) {
      const index = cursor++;
      const slot = slots[index];
      if (slot?.kind === 'ref') return slot;
      const ref = /** @type {const} */ ({ kind: 'ref', current: value });
      slots[index] = ref;
      return ref;
    },
    /** @param {()=>void|(()=>void)} effect @param {unknown[]} dependencies */
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (
        previous?.kind !== 'effect' ||
        dependencies.some(
          (value, offset) => value !== previous.dependencies[offset],
        )
      ) {
        effects.push(() => {
          if (previous?.kind === 'effect') previous.cleanup?.();
          slots[index] = { kind: 'effect', dependencies, cleanup: effect() };
        });
      }
    },
    /** @param {unknown} value */
    useState(value) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { kind: 'state', value };
      const slot = slots[index];
      if (slot.kind !== 'state') throw new Error('Invalid state slot');
      return [
        slot.value,
        (/** @type {unknown} */ next) => {
          if (typeof next === 'function') {
            const updater = /** @type {(old:unknown)=>unknown} */ (next);
            slot.value = updater(slot.value);
          } else slot.value = next;
        },
      ];
    },
    /** @param {()=>unknown} factory */
    useMemo(factory) {
      return factory();
    },
    useTransition() {
      return [false, (/** @type {()=>void} */ callback) => callback()];
    },
  };
  return {
    hooks,
    start() {
      cursor = 0;
      effects = [];
    },
    flush() {
      effects.forEach((effect) => effect());
      effects = [];
    },
    states() {
      return slots
        .filter((slot) => slot.kind === 'state')
        .map((slot) => slot.value);
    },
  };
}

/** @param {string} file @param {(name:string)=>unknown} imports @param {Record<string,unknown>} globals @param {string} extra */
function execute(file, imports, globals = {}, extra = '') {
  const source = readFileSync(join(root, file), 'utf8');
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
    URLSearchParams,
    ...globals,
  });
  return exports;
}

function boundsHarness() {
  const hook = hookHarness();
  /** @type {{moveend:()=>void}|undefined} */ let events;
  /** @type {(()=>void)|undefined} */ let pendingTimer;
  const bounds = { north: 10, south: 0, east: 40, west: 30 };
  const map = {
    getBounds: () => ({
      getNorth: () => bounds.north,
      getSouth: () => bounds.south,
      getEast: () => bounds.east,
      getWest: () => bounds.west,
    }),
  };
  const exports = execute(
    'components/map/MapView.tsx',
    (name) => {
      if (name === 'react') return hook.hooks;
      if (name === 'react-leaflet')
        return {
          useMapEvents: (/** @type {{moveend:()=>void}} */ handlers) => {
            events = handlers;
            return map;
          },
        };
      if (name === 'leaflet') return { divIcon: () => ({}) };
      if (
        name === 'next-intl' ||
        name === 'next/link' ||
        name === 'react-leaflet-cluster' ||
        name === 'react/jsx-runtime' ||
        name.startsWith('../../lib/')
      )
        return {};
      return /** @type {unknown} */ (require(name));
    },
    {
      setTimeout(/** @type {()=>void} */ callback) {
        pendingTimer = callback;
        return 1;
      },
      clearTimeout() {
        pendingTimer = undefined;
      },
    },
    'exports.testBoundsReporter = BoundsReporter;',
  );
  const render = /** @type {(props:BoundsProps)=>null} */ (
    exports.testBoundsReporter
  );
  return {
    bounds,
    /** @param {BoundsProps} props */
    render(props) {
      hook.start();
      render(props);
      hook.flush();
    },
    scheduleMove() {
      events?.moveend();
    },
    flushMove() {
      pendingTimer?.();
      pendingTimer = undefined;
    },
    move() {
      events?.moveend();
      pendingTimer?.();
      pendingTimer = undefined;
    },
  };
}

function selectionHarness() {
  const hook = hookHarness();
  /** @type {Array<{coordinates:number[],zoom:number}>} */ const focusCalls =
    [];
  const map = {
    getZoom: () => 9,
    /** @param {number[]} coordinates @param {number} zoom */
    flyTo: (coordinates, zoom) => focusCalls.push({ coordinates, zoom }),
  };
  const exports = execute(
    'components/map/MapView.tsx',
    (name) => {
      if (name === 'react') return hook.hooks;
      if (name === 'react-leaflet') return { useMap: () => map };
      if (name === 'leaflet') return { divIcon: () => ({}) };
      if (
        name === 'next-intl' ||
        name === 'next/link' ||
        name === 'react-leaflet-cluster' ||
        name === 'react/jsx-runtime' ||
        name.startsWith('../../lib/')
      )
        return {};
      return /** @type {unknown} */ (require(name));
    },
    {},
    'exports.testSelectionFocus = SelectionFocus;',
  );
  const render = /** @type {(props:{place:unknown})=>null} */ (
    exports.testSelectionFocus
  );
  return {
    focusCalls,
    /** @param {unknown} place */
    render(place) {
      hook.start();
      render({ place });
      hook.flush();
    },
  };
}

const query = /** @type {typeof import('../lib/public-discovery-query')} */ (
  execute(
    'lib/public-discovery-query.ts',
    (name) => /** @type {unknown} */ (require(name)),
  )
);

function exploreHarness() {
  const hook = hookHarness();
  let params = new URLSearchParams();
  /** @type {BoundsProps|undefined} */ let mapProps;
  /** @type {Array<{url:string,resolve:(value:unknown)=>void,reject:(error:Error)=>void}>} */ const requests =
    [];
  const exports = execute(
    'components/explore/ExploreClient.tsx',
    (name) => {
      if (name === 'react') return hook.hooks;
      if (name === 'next/navigation')
        return {
          useRouter: () => ({ replace() {}, push() {} }),
          usePathname: () => '/search',
          useSearchParams: () => params,
        };
      if (name === 'next-intl')
        return { useTranslations: () => (/** @type {string} */ key) => key };
      if (name === '../../lib/api')
        return {
          getJson: (/** @type {string} */ url) =>
            new Promise((resolve, reject) => {
              requests.push({ url, resolve, reject });
            }),
        };
      if (name === '../../lib/public-discovery-query') return query;
      if (name === '../../lib/favorite-utils')
        return { buildFavoriteLookup: () => ({}) };
      if (name === '../../lib/review-utils')
        return { buildReviewLookup: () => ({}) };
      if (name === '../map/DynamicMap') return { DynamicMap: 'DynamicMap' };
      if (name === 'react/jsx-runtime') {
        const jsx = (
          /** @type {unknown} */ type,
          /** @type {unknown} */ props,
        ) => {
          if (type === 'DynamicMap')
            mapProps = /** @type {BoundsProps} */ (props);
          return { type, props };
        };
        return { jsx, jsxs: jsx, Fragment: 'Fragment' };
      }
      return {};
    },
    { fetch: () => Promise.resolve({ ok: false }) },
  );
  const render = /** @type {(props:Record<string,unknown>)=>unknown} */ (
    exports.ExploreClient
  );
  return {
    requests,
    states: () => hook.states(),
    mapRequestKey: () => mapProps?.requestKey,
    /** @param {string} intent @param {boolean} flush */
    render(intent, flush = true, locale = 'en') {
      params = new URLSearchParams(intent);
      hook.start();
      render({
        locale,
        businessCategories: [],
        serviceCategories: [],
        regions: [],
        cities: [],
        destinations: [],
        normalizedRegionSlug: params.get('regionSlug') ?? '',
        normalizedCitySlug: params.get('citySlug') ?? '',
        normalizedDestinationSlug: params.get('destinationSlug') ?? '',
      });
      if (flush) hook.flush();
    },
    flush: () => hook.flush(),
    markerRequest() {
      assert.ok(mapProps);
      mapProps.onBoundsChange({ north: 10, south: 0, east: 40, west: 30 });
    },
  };
}

void test('initial bounds and moveend still request markers', () => {
  const harness = boundsHarness();
  /** @type {Bounds[]} */ const requests = [];
  harness.render({
    requestKey: 'q=Lake',
    onBoundsChange: (bounds) => {
      requests.push({ ...bounds });
    },
  });
  assert.equal(requests.length, 1);
  harness.move();
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1], harness.bounds);
});

void test('query and filter intent changes refresh a stationary map exactly once', () => {
  const harness = boundsHarness();
  /** @type {Bounds[]} */ const requests = [];
  /** @param {string} requestKey */
  const render = (requestKey) =>
    harness.render({
      requestKey,
      onBoundsChange: (bounds) => {
        requests.push({ ...bounds });
      },
    });
  render('q=Lake');
  harness.scheduleMove();
  render('q=Museum');
  harness.flushMove();
  assert.equal(
    requests.length,
    2,
    'new intent cancels an outstanding bounds debounce',
  );
  render('q=Museum&types=destination&regionSlug=south');
  assert.equal(requests.length, 3);
  render('q=Museum&types=destination&regionSlug=south');
  assert.equal(
    requests.length,
    3,
    'callback identity alone must not issue another request',
  );
  assert.deepEqual(requests[2], harness.bounds);
});

void test('marker intent covers filters, Nearby and validated locale, but not list-only or UI keys', () => {
  const source = new URLSearchParams(
    'q=Lake&types=service&regionSlug=south&citySlug=sodo&destinationSlug=lake&businessCategory=HOTEL&serviceCategory=ROOM&pricingModel=FIXED&currency=ETB&minPrice=10&maxPrice=100&sort=newest&page=2&limit=7&view=map&locale=fr&unknown=secret',
  );
  const nearby = { lat: 6.1, lng: 37.1, radiusKm: 25 };
  const bounds = { north: 10, south: 0, east: 40, west: 30 };
  const intent = query.buildMapIntentParams(source, 'am', nearby);
  for (const key of [
    'q',
    'types',
    'regionSlug',
    'citySlug',
    'destinationSlug',
    'businessCategory',
    'serviceCategory',
    'pricingModel',
    'currency',
    'minPrice',
    'maxPrice',
  ])
    assert.equal(intent.get(key), source.get(key));
  for (const key of ['page', 'sort', 'view', 'unknown', 'north'])
    assert.equal(intent.has(key), false);
  assert.equal(intent.get('locale'), 'am');
  assert.equal(intent.get('limit'), '200');
  assert.equal(intent.get('lat'), '6.1');
  assert.equal(intent.get('lng'), '37.1');
  assert.equal(intent.get('radiusKm'), '25');
  const request = query.buildMapPlacesParams(source, bounds, 'am', nearby);
  for (const [key, value] of Object.entries(bounds))
    assert.equal(request.get(key), String(value));
  source.set('page', '3');
  source.set('sort', 'name_asc');
  assert.equal(
    query.buildMapIntentParams(source, 'am', nearby).toString(),
    intent.toString(),
  );
  assert.notEqual(
    query.buildMapIntentParams(source, 'en', nearby).toString(),
    intent.toString(),
  );
  const searchRequest = query.buildSearchRequestParams(source, 'am', nearby);
  assert.equal(searchRequest.get('locale'), 'am');
  assert.equal(searchRequest.get('q'), 'Lake');
  assert.equal(searchRequest.get('page'), '3');
  assert.equal(searchRequest.get('sort'), 'name_asc');
  assert.equal(searchRequest.get('lat'), '6.1');
  assert.equal(searchRequest.get('lng'), '37.1');
  assert.equal(searchRequest.get('radiusKm'), '25');
  for (const key of query.publicSearchParamKeys) {
    if (key !== 'view') assert.equal(searchRequest.get(key), source.get(key));
  }
  for (const locale of ['en', 'am']) {
    const plain = query.buildSearchRequestParams(
      new URLSearchParams('q=Lake'),
      locale,
    );
    assert.equal(plain.get('q'), 'Lake');
    assert.equal(plain.get('locale'), locale);
    assert.equal(plain.has('lat'), false);
  }
  assert.equal(searchRequest.has('view'), false);
  assert.equal(searchRequest.has('unknown'), false);
  assert.equal(query.allowedPublicSearchParams(source).has('locale'), false);
  assert.equal(query.canonicalSearchHref(source).includes('locale='), false);
});

void test('changing only locale refreshes stationary map bounds without remounting or changing viewport', () => {
  const harness = boundsHarness();
  /** @type {Bounds[]} */ const requests = [];
  const source = new URLSearchParams('q=Lake&view=map&page=2');
  const onBoundsChange = (/** @type {Bounds} */ bounds) =>
    requests.push({ ...bounds });
  harness.render({
    requestKey: query.buildMapIntentParams(source, 'en').toString(),
    onBoundsChange,
  });
  harness.render({
    requestKey: query.buildMapIntentParams(source, 'am').toString(),
    onBoundsChange,
  });
  harness.render({
    requestKey: query.buildMapIntentParams(source, 'en').toString(),
    onBoundsChange,
  });
  assert.equal(requests.length, 3);
  assert.deepEqual(requests[1], requests[0]);
  assert.deepEqual(requests[2], requests[0]);
});

void test('localized marker labels do not refocus or zoom an unchanged selected place', () => {
  const harness = selectionHarness();
  harness.render({
    type: 'destination',
    id: 'same',
    name: 'English',
    latitude: '6.1',
    longitude: '37.1',
  });
  assert.equal(harness.focusCalls.length, 1);
  harness.render({
    type: 'destination',
    id: 'same',
    name: 'አማርኛ',
    latitude: '6.1',
    longitude: '37.1',
  });
  assert.equal(harness.focusCalls.length, 1);
  harness.render({
    type: 'destination',
    id: 'other',
    name: 'Other',
    latitude: '6.2',
    longitude: '37.2',
  });
  assert.equal(harness.focusCalls.length, 2);
  assert.equal(harness.focusCalls[1].zoom, 12);
});

void test('actual Search and Map effects reject old-locale responses and errors', async () => {
  const harness = exploreHarness();
  harness.render('q=Lake&view=map', true, 'en');
  harness.markerRequest();
  assert.match(harness.requests[0].url, /locale=en/);
  assert.match(harness.requests[1].url, /locale=en/);
  const englishKey = harness.mapRequestKey();
  harness.render('q=Lake&view=map', false, 'am');
  assert.notEqual(harness.mapRequestKey(), englishKey);
  assert.equal(harness.states()[0], null);
  assert.equal(harness.states()[1].length, 0);
  harness.flush();
  harness.markerRequest();
  const amSearch = harness.requests[2];
  const amMap = harness.requests[3];
  assert.match(amSearch.url, /locale=am/);
  assert.match(amMap.url, /locale=am/);
  amSearch.resolve({
    data: [{ name: 'የአማርኛ መዳረሻ', shortDescription: 'መግለጫ' }],
    meta: {},
  });
  amMap.resolve({ data: [{ name: 'የአማርኛ መዳረሻ' }] });
  await settle();
  harness.requests[0].resolve({ data: [{ name: 'Old English' }], meta: {} });
  harness.requests[1].resolve({ data: [{ name: 'Old marker' }] });
  await settle();
  assert.deepEqual(harness.states()[0], {
    data: [{ name: 'የአማርኛ መዳረሻ', shortDescription: 'መግለጫ' }],
    meta: {},
  });
  assert.deepEqual(harness.states()[1], [{ name: 'የአማርኛ መዳረሻ' }]);
  harness.render('q=Lake&view=map', true, 'en');
  harness.markerRequest();
  const latestSearch = harness.requests.at(-2);
  const latestMap = harness.requests.at(-1);
  assert.match(latestSearch.url, /locale=en/);
  assert.match(latestMap.url, /locale=en/);
  latestSearch.resolve({ data: [{ name: 'Canonical English' }], meta: {} });
  latestMap.resolve({ data: [{ name: 'Canonical marker' }] });
  await settle();
  assert.deepEqual(harness.states()[0], {
    data: [{ name: 'Canonical English' }],
    meta: {},
  });
  assert.deepEqual(harness.states()[1], [{ name: 'Canonical marker' }]);
  harness.render('q=Lake&view=map', true, 'am');
  harness.markerRequest();
  const [staleSearch, staleMap] = harness.requests.slice(-2);
  harness.render('q=Lake&view=map', true, 'en');
  harness.markerRequest();
  const [freshSearch, freshMap] = harness.requests.slice(-2);
  freshSearch.resolve({ data: [{ name: 'Latest English' }], meta: {} });
  freshMap.resolve({ data: [{ name: 'Latest marker' }] });
  await settle();
  staleSearch.reject(new Error('Stale language failure'));
  staleMap.reject(new Error('Stale map failure'));
  await settle();
  assert.deepEqual(harness.states()[0], {
    data: [{ name: 'Latest English' }],
    meta: {},
  });
  assert.deepEqual(harness.states()[1], [{ name: 'Latest marker' }]);
  assert.equal(harness.states()[2], null);
  assert.equal(harness.states()[3], false);
  assert.equal(harness.states()[4], null);
});

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

void test('actual Search effects ignore old success/error responses and uncommitted-effect intent races', async () => {
  const harness = exploreHarness();
  harness.render('q=Lake&view=map');
  harness.render('q=Museum&view=map', false);
  harness.requests[0].resolve({ data: ['old'], meta: {} });
  await settle();
  assert.equal(
    harness.states()[0],
    null,
    'old query cannot commit even before the next effect starts',
  );
  harness.flush();
  harness.render('q=Newest&view=map');
  harness.requests[2].resolve({ data: ['new'], meta: {} });
  await settle();
  assert.deepEqual(harness.states()[0], { data: ['new'], meta: {} });
  harness.requests[1].reject(new Error('old failure'));
  await settle();
  assert.deepEqual(harness.states()[0], { data: ['new'], meta: {} });
  assert.equal(harness.states()[4], null);
});

void test('actual marker handler rejects old bounds/query responses without resetting viewport', async () => {
  const harness = exploreHarness();
  harness.render('q=Lake&view=map');
  harness.markerRequest();
  harness.render('q=Museum&view=map', false);
  harness.requests[1].resolve({ data: ['old map'] });
  await settle();
  const oldPlaces = harness.states()[1];
  assert.ok(Array.isArray(oldPlaces));
  assert.equal(oldPlaces.length, 0);
  harness.flush();
  harness.markerRequest();
  const current = harness.requests.at(-1);
  assert.ok(current);
  assert.match(current.url, /q=Museum/);
  assert.match(current.url, /north=10/);
  assert.match(current.url, /limit=200/);
  current.resolve({ data: ['new map'] });
  await settle();
  assert.deepEqual(harness.states()[1], ['new map']);
  harness.markerRequest();
  harness.markerRequest();
  const [oldBounds, newBounds] = harness.requests.slice(-2);
  newBounds.resolve({ data: ['latest bounds'] });
  await settle();
  oldBounds.reject(new Error('old bounds failure'));
  await settle();
  assert.deepEqual(harness.states()[1], ['latest bounds']);
  assert.equal(harness.states()[2], null);
  assert.equal(harness.states()[3], false);
});
