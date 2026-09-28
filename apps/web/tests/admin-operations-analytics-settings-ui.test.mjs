import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('admin operations navigation exposes only implemented investigation, analytics, and settings pages', () => {
  const shell = read('components/admin/AdminWorkspaceShell.tsx');
  for (const label of ['bookings', 'payments', 'analytics', 'settings']) {
    assert.match(shell, new RegExp(`label: '${label}'`));
  }
  assert.match(shell, /label: 'operations'/);
  assert.match(shell, /label: 'insights'/);
  assert.match(shell, /label: 'system'/);
  assert.match(shell, /useTranslations\('adminPortal'\)/);
});

void test('booking and payment investigation BFF routes are bounded, UUID-validated, and token-free', () => {
  const bookingList = read('app/api/admin/bookings/route.ts');
  const bookingDetail = read('app/api/admin/bookings/[bookingId]/route.ts');
  const paymentList = read('app/api/admin/payments/route.ts');
  const paymentDetail = read('app/api/admin/payments/[id]/route.ts');
  const refund = read('app/api/admin/payments/[id]/refund/route.ts');

  assert.match(bookingList, /safeAdminQuery/);
  assert.match(bookingList, /startFrom/);
  assert.match(bookingDetail, /adminUuid/);
  assert.match(paymentList, /safeAdminQuery/);
  assert.match(paymentList, /currency/);
  assert.match(paymentDetail, /adminUuid/);
  assert.match(refund, /adminJson/);
  for (const source of [
    bookingList,
    bookingDetail,
    paymentList,
    paymentDetail,
    refund,
  ]) {
    assert.doesNotMatch(
      source,
      /localStorage|sessionStorage|accessToken|refreshToken/,
    );
  }
});

void test('analytics and settings use real safe BFF data without secret-like editable fields', () => {
  const analytics = read('app/admin/analytics/AdminAnalyticsClient.tsx');
  const settings = read('app/admin/settings/AdminSettingsClient.tsx');
  const settingsBff = read('app/api/admin/settings/route.ts');
  const bff = read('app/api/admin/bff.ts');

  assert.match(analytics, /\/api\/admin\/analytics/);
  assert.match(analytics, /useTranslations\('adminPortal'\)/);
  assert.match(analytics, /t\('capturedRevenue'\)/);
  assert.match(settings, /\/api\/admin\/settings/);
  assert.match(settings, /t\('supportEmail'\)/);
  assert.match(settingsBff, /adminAllowedBody\(request, allowedFields, true\)/);
  assert.match(bff, /rejectUnknown/);
  for (const source of [analytics, settings, settingsBff, bff]) {
    assert.doesNotMatch(
      source,
      /DATABASE_URL|JWT_SECRET|accessToken|refreshToken|localStorage|sessionStorage/,
    );
  }
});

void test('admin payment UI keeps booking and payment status distinct and avoids manual payment-state controls', () => {
  const detail = read('app/admin/payments/[id]/AdminPaymentDetailClient.tsx');
  const summary = read('components/payments/PaymentSummary.tsx');

  assert.match(detail, /t\('relevantAuditHistory'\)/);
  assert.match(summary, /useTranslations\('payment'\)/);
  assert.match(summary, /t\('bookingStatus'\)/);
  assert.match(summary, /t\('paymentStatus'\)/);
  assert.doesNotMatch(detail, /Mark Paid|Force Success|Force Refunded/);
});
