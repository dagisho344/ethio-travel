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

void test('booking BFF routes proxy through secure server session helpers', () => {
  const route = read('app/api/bookings/route.ts');
  assert.match(route, /authenticatedBackendJson/);
  assert.match(route, /validateSameOrigin\(request\)/);
  assert.match(route, /setAuthCookies/);
  assert.match(route, /clearAuthCookies/);
  assert.doesNotMatch(route, /localStorage|sessionStorage/);
});

void test('booking BFF exposes traveler and business booking endpoints', () => {
  assert.match(read('app/api/bookings/route.ts'), /\/users\/me\/bookings/);
  assert.match(
    read('app/api/bookings/[id]/route.ts'),
    /\/users\/me\/bookings\/\$\{id\}/,
  );
  assert.match(
    read('app/api/bookings/[id]/cancel/route.ts'),
    /\/bookings\/\$\{id\}\/cancel/,
  );
  assert.match(
    read('app/api/businesses/[businessId]/bookings/route.ts'),
    /\/businesses\/\$\{businessId\}\/bookings/,
  );
  assert.match(
    read('app/api/businesses/[businessId]/bookings/[id]/[action]/route.ts'),
    /confirm/,
  );
  assert.match(
    read('app/api/businesses/[businessId]/bookings/[id]/[action]/route.ts'),
    /no-show/,
  );
});

void test('book now UI checks availability before creating a booking', () => {
  const widget = read('components/bookings/BookingWidget.tsx');
  assert.match(widget, /Check availability/);
  assert.match(widget, /Request booking/);
  assert.match(widget, /\/api\/services\/\$\{serviceId\}\/availability/);
  assert.match(widget, /\/api\/bookings/);
  assert.match(widget, /stage !== 'available'/);
  assert.match(widget, /Availability changed/);
});

void test('unauthenticated booking actions redirect with safe returnTo', () => {
  const widget = read('components/bookings/BookingWidget.tsx');
  const detail = read('app/bookings/[id]/BookingDetailClient.tsx');
  assert.match(widget, /login\?returnTo=/);
  assert.match(widget, /safeReturnTo/);
  assert.match(detail, /login\?returnTo=/);
});

void test('my bookings page is authenticated and supports status pagination', () => {
  const page = read('app/bookings/page.tsx');
  const client = read('app/bookings/BookingsClient.tsx');
  assert.match(page, /currentTokens/);
  assert.match(page, /redirect\('\/login\?returnTo=\/bookings'\)/);
  assert.match(client, /Booking status/);
  assert.match(client, /page: currentPage/);
  assert.match(client, /\/api\/bookings\?\$\{query\}/);
});

void test('booking detail renders statuses, history and cancellation state', () => {
  const detail = read('app/bookings/[id]/BookingDetailClient.tsx');
  assert.match(detail, /BookingStatusBadge/);
  assert.match(detail, /PaymentStatusBadge/);
  assert.match(detail, /Status history/);
  assert.match(detail, /canTravelerCancel/);
  assert.match(detail, /Cancel booking/);
});

void test('business bookings page includes manager actions and read states', () => {
  const client = read(
    'app/businesses/[businessId]/bookings/BusinessBookingsClient.tsx',
  );
  assert.match(client, /businessActions/);
  assert.match(client, /Confirm/);
  assert.match(client, /Reject/);
  assert.match(client, /Complete/);
  assert.match(client, /No-show/);
  assert.match(client, /You do not have access/);
});

void test('service and explore cards expose booking only for services', () => {
  assert.match(read('app/services/page.tsx'), /BookingWidget/);
  const cards = read('components/cards/TravelCards.tsx');
  assert.match(cards, /result.type === 'service'/);
  assert.match(cards, /BookingWidget/);
});

void test('authenticated navbar exposes My Bookings link', () => {
  const layout = read('components/layout/PublicLayout.tsx');
  assert.match(layout, /href="\/bookings"/);
  assert.match(layout, /My Bookings/);
});

void test('booking frontend does not store auth tokens in browser storage', () => {
  for (const path of [
    'components/bookings/BookingWidget.tsx',
    'app/bookings/BookingsClient.tsx',
    'app/bookings/[id]/BookingDetailClient.tsx',
    'app/businesses/[businessId]/bookings/BusinessBookingsClient.tsx',
    'app/api/bookings/route.ts',
    'app/api/bookings/[id]/route.ts',
    'app/api/bookings/[id]/cancel/route.ts',
    'app/api/businesses/[businessId]/bookings/route.ts',
    'app/api/businesses/[businessId]/bookings/[id]/route.ts',
    'app/api/businesses/[businessId]/bookings/[id]/[action]/route.ts',
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /localStorage|sessionStorage/, path);
    assert.doesNotMatch(source, /accessToken|refreshToken/, path);
  }
});
