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
    /** @param {string} intent @param {boolean} flush */
    render(intent, flush = true) {
      params = new URLSearchParams(intent);
      hook.start();
      render({
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

void test('marker intent covers existing filters and Nearby, but not list-only or UI/locale keys', () => {
  const source = new URLSearchParams(
    'q=Lake&types=service&regionSlug=south&citySlug=sodo&destinationSlug=lake&businessCategory=HOTEL&serviceCategory=ROOM&pricingModel=FIXED&currency=ETB&minPrice=10&maxPrice=100&sort=newest&page=2&view=map&locale=am&unknown=secret',
  );
  const nearby = { lat: 6.1, lng: 37.1, radiusKm: 25 };
  const bounds = { north: 10, south: 0, east: 40, west: 30 };
  const intent = query.buildMapIntentParams(source, nearby);
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
  for (const key of ['page', 'sort', 'view', 'locale', 'unknown', 'north'])
    assert.equal(intent.has(key), false);
  assert.equal(intent.get('limit'), '200');
  assert.equal(intent.get('lat'), '6.1');
  assert.equal(intent.get('lng'), '37.1');
  assert.equal(intent.get('radiusKm'), '25');
  const request = query.buildMapPlacesParams(source, bounds, nearby);
  for (const [key, value] of Object.entries(bounds))
    assert.equal(request.get(key), String(value));
  source.set('page', '3');
  source.set('sort', 'name_asc');
  assert.equal(
    query.buildMapIntentParams(source, nearby).toString(),
    intent.toString(),
  );
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
