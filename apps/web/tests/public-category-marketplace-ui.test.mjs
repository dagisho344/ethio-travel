import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

void test('public category resolver uses only explicit stable family mappings', async () => {
  const resolver = await read('lib/public-service-category.ts');

  for (const family of ['ACCOMMODATION', 'RESTAURANT', 'TOUR', 'TRANSPORT']) {
    assert.match(resolver, new RegExp(`case '${family}'`));
  }
  assert.match(resolver, /href: '\/hotels'/);
  assert.match(resolver, /href: '\/restaurants'/);
  assert.match(resolver, /href: '\/tours'/);
  assert.match(resolver, /href: '\/transport'/);
  assert.doesNotMatch(resolver, /ROOM|MEAL|TRANSFER|toLowerCase\(\)/);
});

void test('public category pages are explicit, paginated, and reuse one bounded Service query', async () => {
  const marketplace = await read(
    'components/public/CategoryMarketplacePage.tsx',
  );
  const pages = await Promise.all(
    ['hotels', 'restaurants', 'tours', 'transport'].map((route) =>
      read(`app/${route}/page.tsx`),
    ),
  );

  assert.match(marketplace, /safePage<Service>\('\/services'/);
  assert.match(marketplace, /family,/);
  assert.match(marketplace, /limit: 12/);
  assert.match(marketplace, /response\.meta\.totalPages/);
  assert.match(marketplace, /No .* available yet/);
  assert.match(marketplace, /\]\);\s+const response = await safePage<Service>/);
  assert.match(pages[0], /family="ACCOMMODATION"/);
  assert.match(pages[1], /family="RESTAURANT"/);
  assert.match(pages[2], /family="TOUR"/);
  assert.match(pages[3], /family="TRANSPORT"/);
});

void test('public Service details use the canonical eligible Service route and safely select one family section', async () => {
  const page = await read('app/services/[id]/page.tsx');
  const details = await read('components/public/ServiceCategoryDetails.tsx');

  assert.match(page, /getJson<Service>\(`\/services\/\$\{id\}`\)/);
  assert.match(page, /uuidV4/);
  assert.match(page, /BookingWidget/);
  assert.match(page, /ReviewPanel/);
  assert.match(details, /case 'ACCOMMODATION'/);
  assert.match(details, /case 'RESTAURANT'/);
  assert.match(details, /case 'TOUR'/);
  assert.match(details, /case 'TRANSPORT'/);
  assert.match(details, /timeZone: 'UTC'/);
  assert.doesNotMatch(
    details,
    /Number\(.*(?:price|fare)|parseFloat|toNumber\(/i,
  );
  assert.doesNotMatch(details, /remaining seats|seats left|live availability/i);
});

void test('public business detail and browse cards use only canonical city-scoped slug routes', async () => {
  const businessDetail = await read(
    'app/regions/[regionSlug]/cities/[citySlug]/businesses/[businessSlug]/page.tsx',
  );
  const businessRoute = await read('lib/public-business-route.ts');
  const businesses = await read('app/businesses/page.tsx');
  const services = await read('app/services/page.tsx');
  const serviceDetail = await read('app/services/[id]/page.tsx');
  const publicServiceCard = await read(
    'components/public/PublicServiceCard.tsx',
  );
  const cards = await read('components/cards/TravelCards.tsx');

  assert.match(businessDetail, /publicBusinessApiPath\(route\)/);
  assert.match(
    businessDetail,
    /`\$\{publicBusinessApiPath\(route\)\}\/services`/,
  );
  assert.match(businessDetail, /ReviewPanel targetType="BUSINESS"/);
  assert.match(
    businessRoute,
    /\/regions\/\$\{encodeURIComponent\(business\.region\.slug\)\}\/cities\/\$\{encodeURIComponent\(business\.city\.slug\)\}\/businesses\/\$\{encodeURIComponent\(business\.slug\)\}/,
  );
  assert.match(businesses, /publicBusinessPath\(business\)/);
  assert.match(serviceDetail, /publicBusinessPath\(/);
  assert.match(publicServiceCard, /publicBusinessPath\(/);
  assert.match(cards, /publicBusinessPath\(business\)/);
  assert.match(cards, /slug: result\.slug/);
  assert.match(services, /return `\/services\/\$\{service\.id\}`/);
  await assert.rejects(read('app/business/[businessId]/page.tsx'));
  assert.doesNotMatch(
    [
      businessDetail,
      businessRoute,
      businesses,
      serviceDetail,
      publicServiceCard,
      cards,
    ].join('\n'),
    /\/business\/\$\{|\/businesses\/\$\{id\}|businessId: business\.id/,
  );
});

void test('public category navigation contains only completed routes and exposes no browser credentials', async () => {
  const layout = await read('components/layout/PublicLayout.tsx');
  const home = await read('app/page.tsx');
  const publicFiles = await Promise.all([
    read('components/public/PublicServiceCard.tsx'),
    read('components/public/CategoryMarketplacePage.tsx'),
    read('components/public/ServiceCategoryDetails.tsx'),
  ]);

  for (const href of ['/hotels', '/restaurants', '/tours', '/transport']) {
    assert.match(layout, new RegExp(`href: '${href}'`));
  }
  assert.doesNotMatch(layout, /\/payments|\/analytics|\/settings/);
  assert.match(home, /href: '\/hotels'/);
  assert.match(home, /href: '\/restaurants'/);
  assert.match(home, /href: '\/tours'/);
  assert.match(home, /href: '\/transport'/);
  assert.doesNotMatch(
    home,
    /businessCategory=HOTEL|businessCategory=RESTAURANT|businessCategory=TOUR_OPERATOR|businessCategory=TRANSPORT/,
  );
  assert.doesNotMatch(
    publicFiles.join('\n'),
    /accessToken|refreshToken|localStorage|sessionStorage/i,
  );
});

void test('Phase 14H category filters are family-locked, explicit, accessible, and pagination-safe', async () => {
  const marketplace = await read(
    'components/public/CategoryMarketplacePage.tsx',
  );
  const filters = await read('components/public/CategoryServiceFilters.tsx');
  const genericFilters = await read('app/services/ServiceFilters.tsx');
  const helper = await read('lib/public-service-filters.ts');
  const servicesPage = await read('app/services/page.tsx');

  assert.match(
    marketplace,
    /parsePublicServiceFilters\(await searchParams, family\)/,
  );
  assert.match(
    marketplace,
    /safePage<Category>\('\/service-categories', \{ family, limit: 100 \}\)/,
  );
  assert.match(marketplace, /family,\n {4}page,\n {4}limit: 12/);
  assert.match(marketplace, /publicServiceFilterHref\(/);
  assert.match(marketplace, /Clear filters/);
  assert.match(filters, /family === 'ACCOMMODATION'/);
  assert.match(filters, /family === 'RESTAURANT'/);
  assert.match(filters, /family === 'TOUR'/);
  assert.match(filters, /family === 'TRANSPORT'/);
  assert.match(filters, /Star class/);
  assert.match(filters, /Minimum room capacity/);
  assert.match(filters, /Reservation supported/);
  assert.match(filters, /Delivery supported/);
  assert.match(filters, /Minimum duration \(days\)/);
  assert.match(filters, /Origin region/);
  assert.match(filters, /Destination city/);
  assert.match(filters, /Clear filters/);
  assert.doesNotMatch(filters, /ROOM|MEAL|TRANSFER|HOTEL_PREMIUM|BUS_TRANSFER/);
  assert.match(helper, /originCitySlug/);
  assert.match(helper, /destinationCitySlug/);
  assert.match(helper, /reservationSupported/);
  assert.match(helper, /publicServiceFilterQuery/);
  assert.doesNotMatch(helper, /Object\.entries\(searchParams\)/);
  assert.match(genericFilters, /publicServiceFilterHref\('\/services'/);
  assert.match(genericFilters, /Clear/);
  assert.match(servicesPage, /aria-label="Services pagination"/);
  assert.match(servicesPage, /publicServiceFilterHref\(/);
  assert.match(servicesPage, /Clear filters/);
});

void test('Phase 14H keeps public Service list responses lightweight and reserves extension trees for detail', async () => {
  const services = await read('../api/src/services/services.service.ts');

  assert.match(
    services,
    /const publicServiceSummarySelect = Prisma\.validator<Prisma\.ServiceSelect>\(\)/,
  );
  assert.match(
    services,
    /const publicServiceDetailSelect = Prisma\.validator<Prisma\.ServiceSelect>\(\)/,
  );
  assert.match(services, /select: publicServiceSummarySelect/);
  assert.match(services, /select: publicServiceDetailSelect/);
  assert.match(services, /orderBy: \[\{ name: 'asc' \}, \{ id: 'asc' \}\]/);
  assert.doesNotMatch(
    services.match(
      /const publicServiceSummarySelect[\s\S]*?type PublicServiceSummaryRecord/,
    )?.[0] ?? '',
    /accommodationDetail|restaurantDetail|tourDetail|transportDetail/,
  );
  assert.match(services, /take: MAX_RESTAURANT_MENUS/);
  assert.match(services, /take: MAX_TOUR_ITINERARY_ITEMS/);
  assert.match(services, /take: MAX_TRANSPORT_ROUTES/);
  assert.doesNotMatch(services, /include: true/);
});
