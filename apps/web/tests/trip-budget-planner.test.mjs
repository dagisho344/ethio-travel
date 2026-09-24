import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import test from 'node:test';

const root = process.cwd();
/** @param {string} path */
const read = (path) => readFileSync(join(root, path), 'utf8');

void test('Trip Budget BFF has fixed paths, UUID validation, body allowlists, and same-origin forwarding', () => {
  const helper = read('app/api/trips/[id]/budget/budget-bff.ts');
  assert.match(helper, /validUuid/);
  assert.match(helper, /Unexpected budget field/);
  assert.match(helper, /Unexpected planned expense field/);
  assert.match(helper, /tripRouteResponse/);
  assert.doesNotMatch(
    helper,
    /localStorage|sessionStorage|accessToken|refreshToken/,
  );
  for (const path of [
    'app/api/trips/[id]/budget/route.ts',
    'app/api/trips/[id]/budget/expenses/route.ts',
    'app/api/trips/[id]/budget/expenses/[expenseId]/route.ts',
  ]) {
    assert.match(read(path), /budgetRouteResponse/, path);
  }
});

void test('Trip Budget UI keeps planned expenses and authoritative booking subtotals separate', () => {
  const source = read('components/trips/TripBudgetPlanner.tsx');
  assert.match(source, /Remaining budget excludes attached\s+bookings/);
  assert.match(source, /Attached booking subtotal/);
  assert.match(source, /not included above/);
  assert.match(source, /window\.confirm\('Remove this budget/);
  assert.match(source, /disabled=\{busy \|\| readOnly\}/);
  assert.match(source, /ACCOMMODATION/);
  assert.match(source, /TRANSPORT/);
  assert.match(source, /FOOD/);
  assert.match(source, /ACTIVITIES/);
  assert.match(source, /OTHER/);
});

void test('Trip detail renders the private responsive budget planner without changing booking context', () => {
  const source = read('components/trips/TripPlannerClient.tsx');
  assert.match(source, /TripBudgetPlanner/);
  assert.match(source, /bookingCost=\{trip\.estimatedBookingCost\}/);
  assert.match(source, /readOnly=\{readOnly\}/);
});
