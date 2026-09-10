import assert from 'node:assert/strict';
import process from 'node:process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('payment BFF routes proxy through secure session helpers', () => {
  const bookingPayments = read('app/api/bookings/[id]/payments/route.ts');
  const adminRefund = read('app/api/admin/payments/[id]/refund/route.ts');
  assert.match(bookingPayments, /authenticatedBackendJson/);
  assert.match(bookingPayments, /validateSameOrigin\(request\)/);
  assert.match(bookingPayments, /\/bookings\/\$\{id\}\/payments/);
  assert.match(adminRefund, /authenticatedBackendJson/);
  assert.match(adminRefund, /validateSameOrigin\(request\)/);
  assert.match(adminRefund, /\/admin\/payments\/\$\{id\}\/refund/);
});

void test('payment BFF exposes traveler business and admin payment endpoints', () => {
  assert.match(read('app/api/payments/[id]/route.ts'), /\/payments\/\$\{id\}/);
  assert.match(
    read('app/api/businesses/[businessId]/payments/route.ts'),
    /\/businesses\/\$\{businessId\}\/payments/,
  );
  assert.match(
    read('app/api/businesses/[businessId]/payments/[paymentId]/route.ts'),
    /\/businesses\/\$\{businessId\}\/payments\/\$\{paymentId\}/,
  );
  assert.match(read('app/api/admin/payments/route.ts'), /\/admin\/payments/);
  assert.match(
    read('app/api/admin/payments/[id]/route.ts'),
    /\/admin\/payments\/\$\{id\}/,
  );
});

void test('payment create body forwards only provider-independent idempotency input', () => {
  const helper = read('lib/payment-bff.ts');
  const panel = read('components/payments/PaymentActionPanel.tsx');
  const createBody = helper.slice(
    helper.indexOf('export function paymentCreateBody'),
    helper.indexOf('export function refundCreateBody'),
  );
  assert.match(createBody, /paymentCreateBody/);
  assert.match(createBody, /idempotencyKey/);
  assert.doesNotMatch(
    createBody,
    /amount|currency|travelerId|businessId|status/,
  );
  assert.match(panel, /JSON\.stringify\(\{ idempotencyKey \}\)/);
  assert.doesNotMatch(panel, /amount:/);
  assert.doesNotMatch(panel, /currency:/);
});

void test('booking detail renders payment action and history states', () => {
  const detail = read('app/bookings/[id]/BookingDetailClient.tsx');
  const panel = read('components/payments/PaymentActionPanel.tsx');
  assert.match(detail, /<PaymentActionPanel/);
  assert.match(panel, /Pay now|Retry payment/);
  assert.match(panel, /Payment history/);
  assert.match(panel, /Payment is not currently available/);
  assert.match(panel, /A payment is already pending/);
  assert.match(panel, /status === 409/);
});

void test('payment presentation supports required statuses and development provider warning', () => {
  const bookingHelpers = read('lib/bookings.ts');
  const paymentHelpers = read('lib/payments.ts');
  const summary = read('components/payments/PaymentSummary.tsx');
  for (const status of [
    'NOT_REQUIRED',
    'UNPAID',
    'PENDING',
    'PAID',
    'PARTIALLY_REFUNDED',
    'REFUNDED',
    'FAILED',
  ]) {
    assert.match(bookingHelpers, new RegExp(status));
  }
  assert.match(paymentHelpers, /DEVELOPMENT/);
  assert.match(
    summary,
    /Development payment provider - no real money is being charged/,
  );
  assert.match(summary, /Transactions/);
  assert.match(summary, /Refunds/);
});

void test('business payments are read-only and expose list/detail pages', () => {
  const list = read(
    'app/businesses/[businessId]/payments/BusinessPaymentsClient.tsx',
  );
  const detail = read(
    'app/businesses/[businessId]/payments/[paymentId]/BusinessPaymentDetailClient.tsx',
  );
  const bookings = read(
    'app/businesses/[businessId]/bookings/BusinessBookingsClient.tsx',
  );
  assert.match(list, /Payment status/);
  assert.match(list, /Provider/);
  assert.match(list, /View payment/);
  assert.match(detail, /PaymentSummary/);
  assert.doesNotMatch(list, /RefundForm|\/refund/);
  assert.doesNotMatch(detail, /RefundForm|\/refund/);
  assert.match(bookings, /View business payments/);
});

void test('admin payments include list detail and refund controls', () => {
  const listPage = read('app/admin/payments/page.tsx');
  const list = read('app/admin/payments/AdminPaymentsClient.tsx');
  const detail = read('app/admin/payments/[id]/AdminPaymentDetailClient.tsx');
  const refund = read('components/payments/RefundForm.tsx');
  assert.match(listPage, /currentTokens/);
  assert.match(list, /Booking ID/);
  assert.match(list, /\/api\/admin\/payments/);
  assert.match(detail, /RefundForm/);
  assert.match(refund, /Full refund/);
  assert.match(refund, /Partial refund/);
  assert.match(refund, /remaining\s+refundable\s+balance/);
  assert.match(refund, /status === 409/);
});

void test('payment UI prevents duplicate mutations and handles authorization states', () => {
  const action = read('components/payments/PaymentActionPanel.tsx');
  const refund = read('components/payments/RefundForm.tsx');
  assert.match(action, /disabled=\{working\}/);
  assert.match(action, /status === 401/);
  assert.match(action, /status === 403/);
  assert.match(action, /status === 404/);
  assert.match(refund, /disabled=\{working \|\| invalidPartial\}/);
  assert.match(refund, /status === 401/);
  assert.match(refund, /status === 403/);
});

void test('authenticated navbar keeps payment administration out of the main account navigation', () => {
  const navigation = read('components/layout/HeaderNavigation.tsx');
  assert.doesNotMatch(navigation, /\/admin\/payments/);
  assert.doesNotMatch(navigation, /Payments/);
});

void test('payment frontend does not store auth tokens in browser storage', () => {
  for (const path of [
    'components/payments/PaymentActionPanel.tsx',
    'components/payments/PaymentSummary.tsx',
    'components/payments/RefundForm.tsx',
    'app/businesses/[businessId]/payments/BusinessPaymentsClient.tsx',
    'app/businesses/[businessId]/payments/[paymentId]/BusinessPaymentDetailClient.tsx',
    'app/admin/payments/AdminPaymentsClient.tsx',
    'app/admin/payments/[id]/AdminPaymentDetailClient.tsx',
    'app/api/bookings/[id]/payments/route.ts',
    'app/api/admin/payments/[id]/refund/route.ts',
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /localStorage|sessionStorage/, path);
    assert.doesNotMatch(source, /accessToken|refreshToken/, path);
  }
});
