import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

void test('category editor resolver maps only stable families to fixed specialized paths', async () => {
  const resolver = await read('lib/service-category-editor.ts');

  assert.match(resolver, /case 'ACCOMMODATION'/);
  assert.match(resolver, /case 'RESTAURANT'/);
  assert.match(resolver, /case 'TOUR'/);
  assert.match(resolver, /case 'TRANSPORT'/);
  assert.match(resolver, /routeSegment: 'accommodation'/);
  assert.match(resolver, /routeSegment: 'restaurant'/);
  assert.match(resolver, /routeSegment: 'tour'/);
  assert.match(resolver, /routeSegment: 'transport'/);
  assert.doesNotMatch(resolver, /ROOM|MEAL|TRANSFER|toLowerCase\(\)/);
});

void test('Services list uses one Manage Service entry and the shared family resolver', async () => {
  const services = await read(
    'components/businesses/BusinessServicesClient.tsx',
  );

  assert.match(services, /getServiceCategoryEditor/);
  assert.match(services, /serviceCategoryEditorPath/);
  assert.match(services, />\s*Manage Service\s*</);
  assert.match(services, /\{categoryEditor\.label\}/);
  assert.doesNotMatch(
    services,
    /service\.category\.code ===|category\.name ===|ROOM|MEAL|TRANSFER/,
  );
});

void test('canonical Service workspace is authenticated, family-aware, and preserves category-change data', async () => {
  const page = await read(
    'app/businesses/manage/[businessId]/services/[serviceId]/page.tsx',
  );
  const workspace = await read(
    'components/businesses/BusinessServiceWorkspaceClient.tsx',
  );
  const header = await read('components/businesses/ServiceWorkspaceHeader.tsx');

  assert.match(page, /currentTokens/);
  assert.match(page, /redirect\('\/login\?returnTo=\/businesses\/manage'\)/);
  assert.match(workspace, /getManagedService\(businessId, serviceId\)/);
  assert.match(
    workspace,
    /Changing the category changes which category-specific editor\s+is/,
  );
  assert.match(workspace, /Existing specialized configuration is preserved/);
  assert.match(workspace, /No category-specific editor is required/);
  assert.match(header, /Read-only access/);
  assert.match(header, /aria-current/);
  assert.doesNotMatch(workspace, /localStorage|sessionStorage|accessToken/i);
});

void test('canonical Service BFF retains scoped routing and now rejects unknown PATCH fields', async () => {
  const route = await read(
    'app/api/businesses/manage/[businessId]/services/[serviceId]/route.ts',
  );
  const helper = await read(
    'app/api/businesses/manage/[businessId]/operations-bff.ts',
  );

  assert.match(route, /managedPath/);
  assert.match(route, /strictAllowedJsonBody\(request, serviceKeys\)/);
  assert.match(route, /BffAuthError\(404, 'Service not found\.'/);
  assert.match(helper, /validateSameOrigin/);
  assert.match(helper, /authenticatedBackendJson/);
  assert.doesNotMatch(route, /localStorage|sessionStorage|accessToken/i);
});

void test('specialized editors share the Service header and retain domain-owned forms', async () => {
  const files = [
    'components/businesses/BusinessAccommodationClient.tsx',
    'components/businesses/BusinessRestaurantClient.tsx',
    'components/businesses/BusinessTourClient.tsx',
    'components/businesses/BusinessTransportClient.tsx',
  ];

  for (const file of files) {
    const source = await read(file);
    assert.match(source, /ServiceWorkspaceHeader/);
    assert.match(source, /canWrite/);
    assert.doesNotMatch(source, /localStorage|sessionStorage|accessToken/i);
  }
});
