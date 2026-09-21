import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

void test('restaurant workspace uses RESTAURANT family visibility and preserves staff read-only controls', async () => {
  const services = await read(
    'components/businesses/BusinessServicesClient.tsx',
  );
  const restaurant = await read(
    'components/businesses/BusinessRestaurantClient.tsx',
  );
  const page = await read(
    'app/businesses/manage/[businessId]/services/[serviceId]/restaurant/page.tsx',
  );

  assert.match(services, /getServiceCategoryEditor/);
  assert.doesNotMatch(services, /category\.code === 'MEAL'/);
  assert.match(restaurant, /canEditBusiness/);
  assert.match(restaurant, /ServiceWorkspaceHeader/);
  assert.match(restaurant, /Deactivate/);
  assert.match(restaurant, /Mark unavailable/);
  assert.doesNotMatch(
    restaurant,
    /DELETE|localStorage|sessionStorage|accessToken/i,
  );
  assert.match(page, /currentTokens/);
  assert.match(page, /redirect\('\/login\?returnTo=\/businesses\/manage'\)/);
});

void test('restaurant BFF routes use fixed paths, UUID checks, strict bodies, and explicit lifecycle actions', async () => {
  const helper = await read(
    'app/api/businesses/manage/[businessId]/services/[serviceId]/restaurant/restaurant-bff.ts',
  );
  const detailRoute = await read(
    'app/api/businesses/manage/[businessId]/services/[serviceId]/restaurant/route.ts',
  );
  const operationsBff = await read(
    'app/api/businesses/manage/[businessId]/operations-bff.ts',
  );
  const menuRoute = await read(
    'app/api/businesses/manage/[businessId]/services/[serviceId]/restaurant/menus/route.ts',
  );
  const itemRoute = await read(
    'app/api/businesses/manage/[businessId]/services/[serviceId]/restaurant/menus/[menuId]/items/route.ts',
  );
  const menuAction = await read(
    'app/api/businesses/manage/[businessId]/services/[serviceId]/restaurant/menus/[menuId]/[action]/route.ts',
  );
  const itemAction = await read(
    'app/api/businesses/manage/[businessId]/services/[serviceId]/restaurant/menus/[menuId]/items/[itemId]/[action]/route.ts',
  );

  assert.match(helper, /authenticatedBackendJson|managedResponse/);
  assert.match(helper, /isManagedUuid/);
  assert.match(helper, /validateSameOrigin|managedResponse/);
  assert.match(detailRoute, /detailStringArrayKeys = \['cuisineTypes'\]/);
  assert.match(detailRoute, /strictAllowedJsonBodyWithStringArrays/);
  assert.match(detailRoute, /reservationSupported/);
  assert.match(operationsBff, /Array\.isArray\(value\)/);
  assert.match(
    operationsBff,
    /value\.every\(\(item\) => typeof item === 'string'\)/,
  );
  assert.match(operationsBff, /Unsupported field: \$\{key\}/);
  assert.match(menuRoute, /sortOrder/);
  assert.match(itemRoute, /currency/);
  assert.match(itemRoute, /strictAllowedJsonBody/);
  assert.match(menuAction, /action !== 'activate' && action !== 'deactivate'/);
  assert.match(
    itemAction,
    /action !== 'available' && action !== 'unavailable'/,
  );
  assert.doesNotMatch(
    helper,
    /localStorage|sessionStorage|refreshToken.*json/i,
  );
});

void test('public Service projection exposes only active menu and available item fields for RESTAURANT services', async () => {
  const services = await read('../api/src/services/services.service.ts');

  assert.match(services, /RESTAURANT_SERVICE_CATEGORY_FAMILY/);
  assert.match(services, /where: \{ isActive: true \}/);
  assert.match(services, /take: MAX_RESTAURANT_MENUS/);
  assert.match(services, /where: \{ available: true \}/);
  assert.match(services, /take: MAX_RESTAURANT_MENU_ITEMS/);
  assert.match(services, /restaurant:/);
  assert.doesNotMatch(
    services.slice(services.indexOf('const publicServiceInclude')),
    /RestaurantBooking|RestaurantAvailability|quantity: true/,
  );
});
