import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

void test('transport workspace uses TRANSPORT family visibility and preserves staff read-only behavior', async () => {
  const services = await read(
    'components/businesses/BusinessServicesClient.tsx',
  );
  const transport = await read(
    'components/businesses/BusinessTransportClient.tsx',
  );
  const page = await read(
    'app/businesses/manage/[businessId]/services/[serviceId]/transport/page.tsx',
  );

  assert.match(services, /service\.category\.family === 'TRANSPORT'/);
  assert.doesNotMatch(services, /category\.code === 'TRANSFER'/);
  assert.match(
    transport,
    /getJson<PaginatedResponse<City>>\('\/cities', \{ limit: 100 \}\)/,
  );
  assert.match(transport, /Staff can view transport routes and schedules/);
  assert.match(transport, /Deactivate/);
  assert.match(transport, /Reactivate/);
  assert.doesNotMatch(
    transport,
    /DELETE|localStorage|sessionStorage|accessToken/i,
  );
  assert.match(page, /currentTokens/);
  assert.match(page, /redirect\('\/login\?returnTo=\/businesses\/manage'\)/);
});

void test('transport BFF uses fixed paths, UUID validation, strict bodies, and explicit lifecycle actions', async () => {
  const helper = await read(
    'app/api/businesses/manage/[businessId]/services/[serviceId]/transport/transport-bff.ts',
  );
  const detail = await read(
    'app/api/businesses/manage/[businessId]/services/[serviceId]/transport/route.ts',
  );
  const routes = await read(
    'app/api/businesses/manage/[businessId]/services/[serviceId]/transport/routes/route.ts',
  );
  const schedules = await read(
    'app/api/businesses/manage/[businessId]/services/[serviceId]/transport/routes/[routeId]/schedules/route.ts',
  );
  const action = await read(
    'app/api/businesses/manage/[businessId]/services/[serviceId]/transport/routes/[routeId]/schedules/[scheduleId]/[action]/route.ts',
  );

  assert.match(helper, /isManagedUuid/);
  assert.match(helper, /managedPath/);
  assert.match(helper, /managedResponse/);
  assert.match(detail, /\['mode', 'operatorName'\]/);
  assert.match(routes, /\['originCityId', 'destinationCityId'\]/);
  assert.match(
    schedules,
    /'departureAt',\s*'arrivalAt',\s*'fare',\s*'currency',\s*'capacity'/s,
  );
  assert.match(detail, /strictAllowedJsonBody/);
  assert.match(routes, /strictAllowedJsonBody/);
  assert.match(schedules, /strictAllowedJsonBody/);
  assert.match(action, /action !== 'activate' && action !== 'deactivate'/);
  assert.doesNotMatch(
    helper,
    /localStorage|sessionStorage|refreshToken.*json/i,
  );
});

void test('public Service projection is bounded and keeps transport separate from booking and availability', async () => {
  const services = await read('../api/src/services/services.service.ts');

  assert.match(services, /TRANSPORT_SERVICE_CATEGORY_FAMILY/);
  assert.match(services, /take: MAX_TRANSPORT_ROUTES/);
  assert.match(services, /take: MAX_TRANSPORT_SCHEDULES_PER_ROUTE/);
  assert.match(services, /where: \{ isActive: true \}/);
  assert.match(services, /transport:/);
  assert.doesNotMatch(
    services.slice(services.indexOf('const publicServiceInclude')),
    /TransportBooking|TransportAvailability|TransportPayment|SeatBooking/,
  );
});
