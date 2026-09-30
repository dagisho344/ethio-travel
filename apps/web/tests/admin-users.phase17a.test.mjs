import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');
/** @param {string} path */
const read = (path) => readFileSync(join(root, path), 'utf8');
/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
/** @param {string} path @returns {Record<string, unknown>} */
function catalog(path) {
  /** @type {unknown} */
  const value = JSON.parse(read(path));
  if (!isRecord(value)) throw new Error(`Invalid catalog: ${path}`);
  return value;
}

void test('new and edit Admin routes reuse protected layout and safe user form', () => {
  const createPage = read('app/admin/users/new/page.tsx');
  const editPage = read('app/admin/users/[userId]/edit/page.tsx');
  const form = read('app/admin/users/AdminUserForm.tsx');
  assert.match(createPage, /AdminUserForm/);
  assert.match(editPage, /currentSessionSnapshot/);
  assert.match(editPage, /AdminUserForm/);
  assert.match(form, /type="password"/);
  assert.match(form, /password !== confirmation/);
  assert.match(form, /roleCodes\.filter/);
  assert.match(form, /setLoadFailed\(true\)/);
  assert.doesNotMatch(form, /passwordHash|localStorage|sessionStorage/);
});

void test('list and detail expose safe fields, lifecycle controls, filters and pagination', () => {
  const list = read('app/admin/users/AdminUsersClient.tsx');
  const detail = read('app/admin/users/[userId]/AdminUserDetailClient.tsx');
  const dialog = read('components/admin/AdminUserStatusDialog.tsx');
  for (const field of ['status', 'role', 'q']) {
    assert.match(list, new RegExp(`params\\.set\\('${field}'`));
  }
  assert.match(list, /page: String\(nextPage\)/);
  assert.match(list, /href="\/admin\/users\/new"/);
  assert.match(list, /businessMembershipCount/);
  assert.match(list, /lastLoginAt/);
  assert.match(detail, /emailVerifiedAt/);
  assert.match(detail, /bookingCount/);
  assert.match(detail, /tripCount/);
  assert.match(detail, /reviewCount/);
  assert.match(detail, /businessMemberships\.map/);
  assert.match(detail, /membershipRoleLabel\(membership\.role\)/);
  assert.match(detail, /membershipStatusLabel\(membership\.status\)/);
  assert.match(detail, /businessStatusLabel\(membership\.business\.status\)/);
  assert.match(detail, /!isSelf/);
  assert.match(dialog, /reason\.trim\(\)/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /event\.key === 'Escape'/);
  assert.match(dialog, /event\.key === 'Tab'/);
  assert.doesNotMatch(list + detail, /passwordHash|refreshTokenHash/);
});

void test('new Admin BFF mutations are allowlisted and same-origin protected', () => {
  const bff = read('app/api/admin/bff.ts');
  const listRoute = read('app/api/admin/users/route.ts');
  const detailRoute = read('app/api/admin/users/[userId]/route.ts');
  const deactivate = read('app/api/admin/users/[userId]/deactivate/route.ts');
  const reactivate = read('app/api/admin/users/[userId]/reactivate/route.ts');
  assert.match(bff, /validateSameOrigin\(request\)/);
  assert.match(listRoute, /adminAllowedBody\(request, createFields, true\)/);
  assert.match(detailRoute, /adminAllowedBody\(request, updateFields, true\)/);
  for (const route of [deactivate, reactivate]) {
    assert.match(route, /adminReasonBody/);
    assert.match(route, /adminUuid/);
    assert.match(route, /adminJson/);
  }
  assert.doesNotMatch(
    listRoute + detailRoute + deactivate + reactivate,
    /localStorage|sessionStorage|accessToken/,
  );
});

void test('new Admin UI catalog keys match in English and Amharic', () => {
  const en = catalog('messages/en.json').adminUsers;
  const am = catalog('messages/am.json').adminUsers;
  if (!isRecord(en) || !isRecord(am))
    throw new Error('Missing Admin User catalog');
  assert.deepEqual(Object.keys(en).sort(), Object.keys(am).sort());
  for (const [key, value] of Object.entries(am)) {
    assert.equal(typeof value, 'string', key);
    assert.ok(typeof value === 'string' && value.length > 0, key);
  }
  if (typeof am.addUser !== 'string' || typeof am.deactivateUser !== 'string')
    throw new Error('Missing Amharic actions');
  assert.match(am.addUser, /[\u1200-\u137f]/);
  assert.match(am.deactivateUser, /[\u1200-\u137f]/);
});
