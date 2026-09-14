import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

void test('business operations BFF routes use HttpOnly server session helpers and same-origin mutation protection', async () => {
  const helper = await read(
    'app/api/businesses/manage/[businessId]/operations-bff.ts',
  );
  const serviceRoute = await read(
    'app/api/businesses/manage/[businessId]/services/route.ts',
  );
  const availability = await read(
    'app/api/businesses/manage/[businessId]/services/[serviceId]/availability/[resource]/route.ts',
  );
  assert.match(helper, /authenticatedBackendJson/);
  assert.match(helper, /validateSameOrigin/);
  assert.match(helper, /allowedJsonBody/);
  assert.match(serviceRoute, /categoryId/);
  assert.match(availability, /availability-config/);
  assert.doesNotMatch(helper, /localStorage|sessionStorage|accessToken.*json/i);
});

void test('workspace operational pages are protected, role-aware, and preserve privacy boundaries', async () => {
  const services = await read(
    'components/businesses/BusinessServicesClient.tsx',
  );
  const availability = await read(
    'components/businesses/BusinessAvailabilityClient.tsx',
  );
  const customers = await read(
    'components/businesses/BusinessCustomersClient.tsx',
  );
  const reviews = await read('components/businesses/BusinessReviewsClient.tsx');
  assert.match(services, /canEditBusiness/);
  assert.match(availability, /Staff can view availability/);
  assert.match(customers, /No contact, account, or trip data/);
  assert.match(reviews, /Only published reviews/);
  assert.doesNotMatch(customers, /email|password|token/i);
});
