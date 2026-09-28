import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {string} path @returns {Record<string, unknown>} */
function readCatalog(path) {
  /** @type {unknown} */
  const parsed = JSON.parse(read(path));
  if (!isRecord(parsed)) throw new Error(`Invalid message catalog: ${path}`);
  return parsed;
}

/** @param {Record<string, unknown>} catalog @param {string} name */
function namespace(catalog, name) {
  const value = catalog[name];
  if (!isRecord(value)) throw new Error(`Missing namespace: ${name}`);
  return value;
}

/** @param {Record<string, unknown>} catalog @param {string} key */
function message(catalog, key) {
  const value = catalog[key];
  if (typeof value !== 'string') throw new Error(`Missing message: ${key}`);
  return value;
}

/** @param {unknown} value @returns {string[]} */
function leafKeys(value, prefix = '') {
  if (typeof value === 'string') return [prefix];
  if (!isRecord(value)) return [];
  /** @type {string[]} */
  const keys = [];
  for (const [key, child] of Object.entries(value)) {
    keys.push(...leafKeys(child, prefix ? `${prefix}.${key}` : key));
  }
  return keys;
}

void test('Business and Admin portal catalogs preserve English/Amharic key parity', () => {
  const en = readCatalog('messages/en.json');
  const am = readCatalog('messages/am.json');

  for (const namespaceName of [
    'businessPortal',
    'businessOnboarding',
    'adminPortal',
  ]) {
    const englishNamespace = namespace(en, namespaceName);
    const amharicNamespace = namespace(am, namespaceName);
    assert.deepEqual(
      leafKeys(englishNamespace).sort(),
      leafKeys(amharicNamespace).sort(),
      `${namespaceName} catalog keys must match`,
    );
  }
  assert.match(
    message(namespace(am, 'businessPortal'), 'workspace'),
    /[\u1200-\u137F]/,
  );
  assert.match(
    message(namespace(am, 'adminPortal'), 'dashboard'),
    /[\u1200-\u137F]/,
  );
});

void test('shared portal shells localize desktop/mobile navigation without changing routes or authorization', () => {
  for (const path of [
    'components/businesses/BusinessWorkspaceShell.tsx',
    'components/admin/AdminWorkspaceShell.tsx',
  ]) {
    const source = read(path);
    assert.match(source, /useTranslations\('/);
    assert.match(source, /event\.key !== 'Escape'/);
    assert.match(source, /aria-current=\{active \? 'page' : undefined\}/);
    assert.doesNotMatch(
      source,
      /localStorage|sessionStorage|accessToken|refreshToken/,
    );
  }
});

void test('localized business and admin dashboards retain decimal-safe financial presentation and protected APIs', () => {
  const businessDashboard = read(
    'components/businesses/BusinessDashboardOverview.tsx',
  );
  const analytics = read('app/admin/analytics/AdminAnalyticsClient.tsx');
  const settings = read('app/admin/settings/AdminSettingsClient.tsx');

  assert.match(businessDashboard, /useTranslations\('businessPortal'\)/);
  assert.match(businessDashboard, /formatLocaleMoney/);
  assert.doesNotMatch(businessDashboard, /Number\(value\)/);
  assert.match(analytics, /useTranslations\('adminPortal'\)/);
  assert.match(analytics, /formatLocaleMoney/);
  assert.match(analytics, /\/api\/admin\/analytics/);
  assert.match(settings, /useTranslations\('adminPortal'\)/);
  assert.match(settings, /\/api\/admin\/settings/);
  assert.doesNotMatch(
    settings,
    /DATABASE_URL|JWT_SECRET|accessToken|refreshToken/,
  );
});

void test('localized onboarding and operations retain existing server-authorized actions and owner content', () => {
  const onboarding = read('components/businesses/BusinessOnboardingWizard.tsx');
  const services = read('components/businesses/BusinessServicesClient.tsx');
  const customers = read('components/businesses/BusinessCustomersClient.tsx');
  const reviews = read('components/businesses/BusinessReviewsClient.tsx');

  assert.match(onboarding, /useTranslations\('businessOnboarding'\)/);
  assert.match(onboarding, /createBusinessDraft/);
  assert.match(onboarding, /localStorage\.removeItem\(storageKey\)/);
  assert.match(services, /useTranslations\('businessPortal'\)/);
  assert.match(services, /serviceCategoryEditorPath/);
  assert.match(customers, /formatLocaleDate/);
  assert.match(reviews, /t\('officialResponse'\)/);
  for (const source of [onboarding, services, customers, reviews]) {
    assert.doesNotMatch(source, /accessToken|refreshToken/);
  }
});

void test('profile, settings, and investigation views localize presentation while retaining safe money and backend routes', () => {
  const profile = read('components/businesses/BusinessProfileEditor.tsx');
  const settings = read('components/businesses/BusinessSettingsClient.tsx');
  const bookings = read('app/admin/bookings/AdminBookingsClient.tsx');
  const payments = read('app/admin/payments/AdminPaymentsClient.tsx');

  for (const source of [profile, settings, bookings, payments]) {
    assert.match(source, /useTranslations\('/);
    assert.doesNotMatch(
      source,
      /accessToken|refreshToken|localStorage|sessionStorage/,
    );
  }
  assert.match(profile, /updateManagedBusiness/);
  assert.match(settings, /getManagedBusiness/);
  assert.match(bookings, /\/api\/admin\/bookings/);
  assert.match(bookings, /formatLocaleMoney/);
  assert.match(payments, /\/api\/admin\/payments/);
  assert.match(payments, /formatLocaleMoney/);
  assert.doesNotMatch(bookings, /Mark Paid|Force Success|Force Refunded/);
  assert.doesNotMatch(payments, /Mark Paid|Force Success|Force Refunded/);
});

void test('business locations and protected admin lists localize fixed labels without changing their scoped APIs', () => {
  const locations = read('components/businesses/BusinessLocationsClient.tsx');
  const users = read('app/admin/users/AdminUsersClient.tsx');
  const audit = read('app/admin/audit/AdminAuditClient.tsx');

  for (const source of [locations, users, audit]) {
    assert.match(source, /useTranslations\('/);
    assert.doesNotMatch(
      source,
      /accessToken|refreshToken|localStorage|sessionStorage/,
    );
  }
  assert.match(locations, /getLocations\(businessId\)/);
  assert.match(locations, /saveLocationHours\(businessId, location\.id/);
  assert.match(users, /\/api\/admin\/users/);
  assert.match(audit, /\/api\/admin\/audit/);
});

void test('specialized service editors and administrative detail screens localize fixed chrome without changing scoped records', () => {
  const accommodation = read(
    'components/businesses/BusinessAccommodationClient.tsx',
  );
  const restaurant = read('components/businesses/BusinessRestaurantClient.tsx');
  const tour = read('components/businesses/BusinessTourClient.tsx');
  const transport = read('components/businesses/BusinessTransportClient.tsx');
  const serviceWorkspace = read(
    'components/businesses/BusinessServiceWorkspaceClient.tsx',
  );
  const businessDetail = read(
    'app/admin/businesses/[businessId]/AdminBusinessDetailClient.tsx',
  );
  const userDetail = read('app/admin/users/[userId]/AdminUserDetailClient.tsx');
  const verificationDetail = read(
    'app/admin/verifications/[verificationId]/AdminVerificationDetailClient.tsx',
  );
  const bookingDetail = read(
    'app/admin/bookings/[bookingId]/AdminBookingDetailClient.tsx',
  );
  const paymentDetail = read(
    'app/admin/payments/[id]/AdminPaymentDetailClient.tsx',
  );
  const reportDetail = read(
    'app/admin/reports/[reportId]/AdminReportDetailClient.tsx',
  );
  const reviewDetail = read(
    'app/admin/moderation/reviews/[reviewId]/AdminReviewDetailClient.tsx',
  );
  const destinationEditor = read(
    'app/admin/destinations/AdminDestinationEditor.tsx',
  );
  const noteDialog = read('components/admin/AdminNoteActionDialog.tsx');

  for (const source of [
    accommodation,
    restaurant,
    tour,
    transport,
    serviceWorkspace,
    businessDetail,
    userDetail,
    verificationDetail,
    bookingDetail,
    paymentDetail,
    reportDetail,
    reviewDetail,
    destinationEditor,
    noteDialog,
  ]) {
    assert.match(source, /useTranslations\('/);
    assert.doesNotMatch(
      source,
      /accessToken|refreshToken|localStorage|sessionStorage/,
    );
  }
  assert.match(accommodation, /roomTypeAction/);
  assert.match(restaurant, /restaurantMenuAction/);
  assert.match(tour, /updateManagedTourItineraryItem/);
  assert.match(transport, /transportScheduleAction/);
  assert.match(serviceWorkspace, /getServiceCategoryEditor/);
  assert.match(serviceWorkspace, /useTranslations\('businessPortal'\)/);
  assert.match(businessDetail, /\/api\/admin\/businesses/);
  assert.match(userDetail, /\/api\/admin\/users/);
  assert.match(verificationDetail, /getPrivateDocumentAccess/);
  assert.match(verificationDetail, /useTranslations\('adminPortal'\)/);
  assert.match(bookingDetail, /\/api\/admin\/bookings/);
  assert.match(bookingDetail, /formatMoney/);
  assert.match(paymentDetail, /\/api\/admin\/payments/);
  assert.match(reportDetail, /\/api\/admin\/reports/);
  assert.match(reviewDetail, /\/api\/admin\/reviews/);
  assert.match(destinationEditor, /\/api\/admin\/destinations/);
  assert.match(noteDialog, /event\.key === 'Escape'/);
  assert.match(noteDialog, /useTranslations\('adminPortal'\)/);
  assert.match(destinationEditor, /useTranslations\('adminPortal'\)/);
});
