import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('public discovery cards retain canonical details while surfacing supported traveler actions', () => {
  const cards = read('components/cards/TravelCards.tsx');
  const publicServiceCard = read('components/public/PublicServiceCard.tsx');
  const serviceDetail = read('app/services/[id]/page.tsx');
  const businessDetail = read(
    'app/regions/[regionSlug]/cities/[citySlug]/businesses/[businessSlug]/page.tsx',
  );
  const destinationDetail = read(
    'app/regions/[regionSlug]/cities/[citySlug]/destinations/[destinationSlug]/page.tsx',
  );
  const map = read('components/map/MapView.tsx');

  for (const source of [cards, publicServiceCard, serviceDetail]) {
    assert.match(source, /BookingWidget/);
    assert.match(source, /AddToTripButton/);
  }
  for (const source of [cards, businessDetail]) {
    assert.match(source, /StartConversationButton/);
  }
  for (const source of [
    cards,
    destinationDetail,
    businessDetail,
    serviceDetail,
  ]) {
    assert.match(source, /FavoriteButton/);
  }
  assert.match(cards, /publicBusinessPath/);
  assert.match(cards, /publicDestinationPath/);
  assert.match(cards, /`\/services\/\$\{service\.id\}`/);
  assert.match(map, /publicBusinessPath/);
  assert.match(map, /publicDestinationPath/);
  assert.match(map, /`\/services\/\$\{encodeURIComponent\(place\.id\)\}`/);
});

void test('add to trip uses the existing owned-trip BFF with guest handoff and day selection', () => {
  const component = read('components/trips/AddToTripButton.tsx');
  const tripsBff = read('app/api/trips/bff.ts');

  assert.match(
    component,
    /\/api\/trips\?page=\$\{tripPage\}&limit=20&sort=SOONEST/,
  );
  assert.match(component, /\/api\/trips\/\$\{tripId\}/);
  assert.match(
    component,
    /\/api\/trips\/\$\{selectedTrip\.id\}\/days\/\$\{selectedDayId\}\/items/,
  );
  assert.match(component, /status !== 'ARCHIVED'/);
  assert.match(component, /router\.push\(`\/login\?returnTo=/);
  assert.match(
    component,
    /safeReturnTo\(pathname, searchParams\.toString\(\)\)/,
  );
  assert.match(component, /destinationId: targetId/);
  assert.match(component, /attractionId: targetId/);
  assert.match(component, /businessId: targetId/);
  assert.match(component, /serviceId: targetId/);
  assert.match(component, /tripRequestId/);
  assert.match(component, /let current = true/);
  assert.match(component, /role="dialog"/);
  assert.match(component, /event\.key !== 'Escape'/);
  assert.match(
    component,
    /!selectedTrip \|\|\s*!selectedDayId \|\|\s*adding \|\|\s*Boolean\(addedTripId\)/,
  );
  assert.doesNotMatch(
    component,
    /localStorage|sessionStorage|accessToken|refreshToken/,
  );
  assert.match(tripsBff, /validateSameOrigin\(request\)/);
  assert.match(tripsBff, /authenticatedBackendJson/);
});

void test('existing protected action components retain authorization, eligibility, and duplicate-submit safeguards', () => {
  const favorite = read('components/favorites/FavoriteButton.tsx');
  const conversation = read('components/messaging/StartConversationButton.tsx');
  const booking = read('components/bookings/BookingWidget.tsx');
  const trips = read('components/trips/TripPlannerClient.tsx');

  assert.match(favorite, /err\.status === 401/);
  assert.match(favorite, /err\.status === 409/);
  assert.match(favorite, /disabled=\{pending\}/);
  assert.match(conversation, /cause\.status === 401/);
  assert.match(
    conversation,
    /cause\.status === 403 \|\| cause\.status === 404/,
  );
  assert.match(conversation, /disabled=\{working\}/);
  assert.match(booking, /\/api\/services\/\$\{serviceId\}\/availability/);
  assert.match(booking, /\/api\/bookings/);
  assert.match(booking, /Availability changed before booking was created/);
  assert.match(trips, /readOnly = trip\.status === 'ARCHIVED'/);
  assert.match(
    trips,
    /\/api\/trips\/\$\{trip\.id\}\/days\/\$\{day\.id\}\/items/,
  );
});
