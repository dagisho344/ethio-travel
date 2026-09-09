import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import test from 'node:test';

const root = process.cwd();
/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('Trip Planner BFF uses authenticated server forwarding and same-origin checks', () => {
  const helper = read('app/api/trips/bff.ts');
  assert.match(helper, /authenticatedBackendJson/);
  assert.match(helper, /validateSameOrigin\(request\)/);
  assert.match(helper, /clearAuthCookies/);
  assert.doesNotMatch(helper, /localStorage|sessionStorage/);
  for (const path of [
    'app/api/trips/route.ts',
    'app/api/trips/[id]/route.ts',
    'app/api/trips/[id]/archive/route.ts',
    'app/api/trips/[id]/days/[dayId]/route.ts',
    'app/api/trips/[id]/days/[dayId]/items/route.ts',
    'app/api/trips/[id]/days/[dayId]/items/[itemId]/route.ts',
    'app/api/trips/[id]/days/[dayId]/items/reorder/route.ts',
  ]) {
    assert.match(read(path), /tripRouteResponse/, path);
  }
});

void test('Trip list has authenticated loading, empty, status, and pagination states', () => {
  const source = read('components/trips/TripsClient.tsx');
  assert.match(source, /\/api\/trips/);
  assert.match(source, /trip\.status/);
  assert.match(source, /No trips planned yet/);
  assert.match(source, /Loading your trips/);
  assert.match(source, /Previous/);
  assert.match(source, /Next/);
});

void test('new-trip form uses actual location APIs and validates date-only values before creation', () => {
  const source = read('components/trips/CreateTripForm.tsx');
  assert.match(source, /getJson.*\/regions/);
  assert.match(source, /getJson.*\/cities/);
  assert.match(source, /\/regions\/\$\{selectedDestinationRegion\.slug\}/);
  assert.match(source, /isValidCalendarDate/);
  assert.match(source, /startDate > endDate/);
  assert.match(source, /\/api\/trips/);
  assert.match(source, /originCityId/);
  assert.match(source, /primaryDestinationId/);
});

void test('planner renders calendar days, safe booking context, and archived state', () => {
  const source = read('components/trips/TripPlannerClient.tsx');
  assert.match(source, /trip\.days\.map/);
  assert.match(source, /formatTripDate/);
  assert.match(source, /item\.booking/);
  assert.match(source, /\/bookings\/\$\{item\.booking\.id\}/);
  assert.match(source, /This trip is archived/);
  assert.match(source, /readOnly/);
});

void test('planner adds only selected real public catalog items or owned bookings', () => {
  const source = read('components/trips/TripPlannerClient.tsx');
  assert.match(source, /getJson.*\/search/);
  assert.match(source, /types: catalogType/);
  assert.match(source, /\/api\/bookings\?limit=100/);
  assert.match(source, /destinationId = targetId/);
  assert.match(source, /attractionId = targetId/);
  assert.match(source, /businessId = targetId/);
  assert.match(source, /serviceId = targetId/);
  assert.match(source, /bookingId = targetId/);
});

void test('planner uses server-authoritative add, edit, remove, and transactional reorder routes', () => {
  const source = read('components/trips/TripPlannerClient.tsx');
  assert.match(source, /items`, \{\s+method: 'POST'/);
  assert.match(source, /method: 'PATCH'/);
  assert.match(source, /method: 'DELETE'/);
  assert.match(source, /items\/reorder/);
  assert.match(source, /itemIds: ids/);
  assert.match(source, /await loadTrip\(\)/);
});

void test('Trip Planner routes are protected and navigation exposes My Trips', () => {
  for (const path of [
    'app/trips/page.tsx',
    'app/trips/new/page.tsx',
    'app/trips/[id]/page.tsx',
  ]) {
    assert.match(read(path), /currentTokens/);
    assert.match(read(path), /redirect/);
  }
  assert.match(read('components/layout/PublicLayout.tsx'), /href="\/trips"/);
});

void test('Trip Planner does not store session credentials in browser storage', () => {
  for (const path of [
    'components/trips/TripsClient.tsx',
    'components/trips/CreateTripForm.tsx',
    'components/trips/TripPlannerClient.tsx',
    'app/api/trips/bff.ts',
  ]) {
    assert.doesNotMatch(
      read(path),
      /localStorage|sessionStorage|accessToken|refreshToken/,
      path,
    );
  }
});
