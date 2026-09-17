import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

void test('accommodation workspace is linked for ACCOMMODATION-family services and keeps staff read-only', async () => {
  const services = await read(
    'components/businesses/BusinessServicesClient.tsx',
  );
  const accommodation = await read(
    'components/businesses/BusinessAccommodationClient.tsx',
  );
  const page = await read(
    'app/businesses/manage/[businessId]/services/[serviceId]/accommodation/page.tsx',
  );

  assert.match(services, /service\.category\.family === 'ACCOMMODATION'/);
  assert.match(services, /Accommodation/);
  assert.match(accommodation, /canEditBusiness/);
  assert.match(accommodation, /Staff can view accommodation details/);
  assert.match(accommodation, /roomTypeAction/);
  assert.doesNotMatch(
    accommodation,
    /localStorage|sessionStorage|accessToken/i,
  );
  assert.match(page, /currentTokens/);
  assert.match(page, /redirect\('\/login\?returnTo=\/businesses\/manage'\)/);
});

void test('accommodation BFF routes use fixed paths, UUID validation, strict bodies, and same-origin mutations', async () => {
  const helper = await read(
    'app/api/businesses/manage/[businessId]/operations-bff.ts',
  );
  const detailRoute = await read(
    'app/api/businesses/manage/[businessId]/services/[serviceId]/accommodation/route.ts',
  );
  const roomRoute = await read(
    'app/api/businesses/manage/[businessId]/services/[serviceId]/accommodation/rooms/route.ts',
  );
  const actionRoute = await read(
    'app/api/businesses/manage/[businessId]/services/[serviceId]/accommodation/rooms/[roomTypeId]/[action]/route.ts',
  );

  assert.match(helper, /authenticatedBackendJson/);
  assert.match(helper, /validateSameOrigin/);
  assert.match(helper, /strictAllowedJsonBody/);
  assert.match(helper, /Unsupported field/);
  assert.match(helper, /isManagedUuid/);
  assert.match(detailRoute, /starClass/);
  assert.match(roomRoute, /basePrice/);
  assert.match(actionRoute, /action !== 'activate' && action !== 'deactivate'/);
  assert.doesNotMatch(
    helper,
    /localStorage|sessionStorage|refreshToken.*json/i,
  );
});

void test('public service projection exposes only active room catalogue fields and never room quantity', async () => {
  const services = await read('../api/src/services/services.service.ts');

  assert.match(services, /where: \{ isActive: true \}/);
  assert.match(services, /ACCOMMODATION_SERVICE_CATEGORY_FAMILY/);
  assert.match(services, /accommodation:/);
  assert.doesNotMatch(
    services.slice(services.indexOf('const publicServiceInclude')),
    /quantity: true/,
  );
});
