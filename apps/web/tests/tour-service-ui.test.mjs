import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

void test('tour workspace uses TOUR family visibility and preserves staff read-only controls', async () => {
  const services = await read(
    'components/businesses/BusinessServicesClient.tsx',
  );
  const tour = await read('components/businesses/BusinessTourClient.tsx');
  const page = await read(
    'app/businesses/manage/[businessId]/services/[serviceId]/tour/page.tsx',
  );

  assert.match(services, /getServiceCategoryEditor/);
  assert.doesNotMatch(services, /category\.code === 'TOUR'/);
  assert.match(tour, /canEditBusiness/);
  assert.match(tour, /ServiceWorkspaceHeader/);
  assert.match(tour, /Edit itinerary item/);
  assert.doesNotMatch(tour, /DELETE|localStorage|sessionStorage|accessToken/i);
  assert.match(page, /currentTokens/);
  assert.match(page, /redirect\('\/login\?returnTo=\/businesses\/manage'\)/);
});

void test('tour BFF routes use fixed paths, UUID checks, strict bodies, and declared string arrays', async () => {
  const helper = await read(
    'app/api/businesses/manage/[businessId]/services/[serviceId]/tour/tour-bff.ts',
  );
  const detailRoute = await read(
    'app/api/businesses/manage/[businessId]/services/[serviceId]/tour/route.ts',
  );
  const itineraryRoute = await read(
    'app/api/businesses/manage/[businessId]/services/[serviceId]/tour/itinerary/route.ts',
  );
  const itemRoute = await read(
    'app/api/businesses/manage/[businessId]/services/[serviceId]/tour/itinerary/[itemId]/route.ts',
  );
  const operationsBff = await read(
    'app/api/businesses/manage/[businessId]/operations-bff.ts',
  );

  assert.match(helper, /authenticatedBackendJson|managedResponse/);
  assert.match(helper, /isManagedUuid/);
  assert.match(helper, /validateSameOrigin|managedResponse/);
  assert.match(
    detailRoute,
    /detailStringArrayKeys = \['inclusions', 'exclusions'\]/,
  );
  assert.match(detailRoute, /strictAllowedJsonBodyWithStringArrays/);
  assert.match(detailRoute, /durationDays/);
  assert.match(operationsBff, /Array\.isArray\(value\)/);
  assert.match(
    operationsBff,
    /value\.every\(\(item\) => typeof item === 'string'\)/,
  );
  assert.match(operationsBff, /Unsupported field: \$\{key\}/);
  assert.match(itineraryRoute, /strictAllowedJsonBody/);
  assert.match(itineraryRoute, /dayNumber/);
  assert.match(itemRoute, /itineraryPathSuffix/);
  assert.doesNotMatch(
    helper,
    /localStorage|sessionStorage|refreshToken.*json/i,
  );
});

void test('public Service projection exposes only safe bounded itinerary content for TOUR services', async () => {
  const services = await read('../api/src/services/services.service.ts');

  assert.match(services, /TOUR_SERVICE_CATEGORY_FAMILY/);
  assert.match(services, /take: MAX_TOUR_ITINERARY_ITEMS/);
  assert.match(services, /tour:/);
  assert.doesNotMatch(
    services.slice(services.indexOf('const publicServiceInclude')),
    /TourBooking|TourAvailability|TourPayment/,
  );
});
