import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

/** @typedef {Record<string, unknown>} JsonObject */

/** @param {unknown} value @returns {value is JsonObject} */
function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {string} path */
function catalog(path) {
  const parsed = /** @type {unknown} */ (JSON.parse(read(path)));
  if (!isObject(parsed)) throw new Error(`${path} must be a JSON object`);
  return parsed;
}

/** @param {JsonObject} value @param {string} key */
function namespace(value, key) {
  const item = value[key];
  if (!isObject(item)) throw new Error(`Missing ${key} namespace`);
  return item;
}

void test('booking, payment, trip, budget, and sharing catalogs have exact English/Amharic key parity', () => {
  const english = catalog('messages/en.json');
  const amharic = catalog('messages/am.json');

  for (const key of [
    'bookings',
    'payment',
    'trips',
    'tripBudget',
    'tripSharing',
  ]) {
    const en = namespace(english, key);
    const am = namespace(amharic, key);
    assert.deepEqual(Object.keys(am).sort(), Object.keys(en).sort(), key);
  }

  assert.match(
    String(namespace(amharic, 'bookings').title),
    /[\u1200-\u137f]/u,
  );
  assert.match(String(namespace(amharic, 'trips').title), /[\u1200-\u137f]/u);
  assert.match(
    String(namespace(amharic, 'tripSharing').sharedItinerary),
    /[\u1200-\u137f]/u,
  );
});

void test('localized booking and payment UI retains safe mutations and Decimal-safe presentation', () => {
  for (const path of [
    'components/bookings/BookingWidget.tsx',
    'app/bookings/BookingsClient.tsx',
    'app/bookings/[id]/BookingDetailClient.tsx',
  ]) {
    const source = read(path);
    assert.match(source, /useTranslations\('bookings'\)/, path);
    assert.match(source, /resolveLocale\(useLocale\(\)\)/, path);
  }

  const widget = read('components/bookings/BookingWidget.tsx');
  const payment = read('components/payments/PaymentActionPanel.tsx');
  assert.match(widget, /safeReturnTo/);
  assert.match(widget, /\/api\/services\/\$\{serviceId\}\/availability/);
  assert.match(widget, /\/api\/bookings/);
  assert.match(payment, /JSON\.stringify\(\{ idempotencyKey \}\)/);
  assert.match(payment, /formatLocaleMoney/);
  assert.doesNotMatch(
    `${widget}\n${payment}`,
    /localStorage|sessionStorage|accessToken|refreshToken/,
  );
});

void test('localized trip and budget presentation preserves calendar dates, ownership routes, and separate booking subtotals', () => {
  const planner = read('components/trips/TripPlannerClient.tsx');
  const addToTrip = read('components/trips/AddToTripButton.tsx');
  const budget = read('components/trips/TripBudgetPlanner.tsx');

  for (const source of [planner, addToTrip]) {
    assert.match(source, /useTranslations\('trips'\)/);
    assert.match(source, /formatLocaleCalendarDate/);
  }
  assert.match(planner, /readOnly = trip\.status === 'ARCHIVED'/);
  assert.match(addToTrip, /login\?returnTo=/);
  assert.match(addToTrip, /Boolean\(addedTripId\)/);
  assert.match(budget, /useTranslations\('tripBudget'\)/);
  assert.match(budget, /formatLocaleMoney/);
  assert.match(budget, /t\('bookingSubtotal'/);
  assert.match(budget, /bookingCost/);
  assert.doesNotMatch(budget, /parseFloat|toNumber\(\)/);
});

void test('localized sharing keeps fragment-only token resolution and public privacy boundaries', () => {
  const owner = read('components/trips/TripSharePanel.tsx');
  const shared = read('components/trips/SharedTripClient.tsx');

  assert.match(owner, /useTranslations\('tripSharing'\)/);
  assert.match(owner, /\/shared-trip#\$\{secret\.token\}/);
  assert.match(owner, /navigator\.clipboard\.writeText/);
  assert.doesNotMatch(owner, /localStorage|sessionStorage/);
  assert.match(shared, /window\.location\.hash\.slice\(1\)/);
  assert.match(shared, /window\.history\.replaceState/);
  assert.match(shared, /\/api\/trip-shares\/resolve/);
  assert.match(shared, /useTranslations\('tripSharing'\)/);
  assert.doesNotMatch(
    shared,
    /localStorage|sessionStorage|URLSearchParams|window\.location\.search|budget|booking|notes/,
  );
});
