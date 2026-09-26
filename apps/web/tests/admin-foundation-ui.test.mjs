import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('admin route chrome is distinct while public chrome remains available elsewhere', () => {
  const chrome = read('components/layout/RouteAwareChrome.tsx');
  const topBar = read('components/layout/AdminPortalTopBar.tsx');
  const accountDropdown = read('components/layout/AccountDropdown.tsx');
  const layout = read('app/admin/layout.tsx');

  assert.match(chrome, /pathname === '\/admin'/);
  assert.match(chrome, /pathname\.startsWith\('\/admin\/'/);
  assert.match(chrome, /AdminPortalTopBar/);
  assert.match(chrome, /isAdminPortal \? null : nonBusinessFooter/);
  assert.match(topBar, /useTranslations\('portal'\)/);
  assert.match(topBar, /t\('admin'\)/);
  assert.match(topBar, /NotificationBell/);
  assert.match(topBar, /AccountDropdown/);
  assert.doesNotMatch(topBar, /LogoutButton/);
  assert.match(accountDropdown, /LogoutButton/);
  assert.match(accountDropdown, /t\('profile'\)/);
  assert.match(accountDropdown, /t\('trips'\)/);
  assert.match(accountDropdown, /t\('assistant'\)/);
  assert.match(accountDropdown, /t\('messages'\)/);
  assert.match(chrome, /hasAdminDashboard/);
  assert.match(topBar, /border-slate-200 bg-white\/95 backdrop-blur/);
  assert.match(
    accountDropdown,
    /text-slate-700 transition hover:bg-slate-50 hover:text-highland/,
  );
  assert.match(topBar, /text-highland transition hover:bg-emerald-50/);
  assert.doesNotMatch(topBar, /bg-slate-950/);
  assert.match(layout, /currentSessionSnapshot/);
  assert.match(layout, /roles\.includes\('ADMIN'\)/);
  assert.match(layout, /redirect\('\/explore'\)/);
});

void test('admin shell has only completed Phase 13A routes, active navigation, and a mobile drawer', () => {
  const shell = read('components/admin/AdminWorkspaceShell.tsx');
  for (const label of [
    'Dashboard',
    'Users',
    'Businesses',
    'Verifications',
    'Audit',
  ]) {
    assert.match(shell, new RegExp(`label: '${label}'`));
  }
  assert.match(shell, /aria-current=\{active \? 'page' : undefined\}/);
  assert.match(shell, /admin-workspace-drawer/);
  assert.match(shell, /aria-modal="true"/);
  assert.match(shell, /event\.key !== 'Escape'/);
});

void test('admin BFF routes remain same-origin, allowlisted, and token-free', () => {
  const bff = read('app/api/admin/bff.ts');
  const userSuspend = read('app/api/admin/users/[userId]/suspend/route.ts');
  const businessRestore = read(
    'app/api/admin/businesses/[businessId]/restore/route.ts',
  );

  assert.match(bff, /authenticatedBackendJson/);
  assert.match(bff, /validateSameOrigin/);
  assert.match(bff, /adminReasonBody/);
  assert.match(bff, /adminUuid/);
  assert.match(userSuspend, /adminReasonBody/);
  assert.match(businessRestore, /adminReasonBody/);
  for (const path of [bff, userSuspend, businessRestore]) {
    assert.doesNotMatch(
      path,
      /localStorage|sessionStorage|accessToken|refreshToken/,
    );
  }
});

void test('administrator pages use real BFF data and require a reason for lifecycle actions', () => {
  const dashboard = read('app/admin/AdminDashboardClient.tsx');
  const users = read('app/admin/users/AdminUsersClient.tsx');
  const businesses = read('app/admin/businesses/AdminBusinessesClient.tsx');
  const dialog = read('components/admin/AdminActionDialog.tsx');
  const audit = read('app/admin/audit/AdminAuditClient.tsx');

  assert.match(dashboard, /\/api\/admin\/dashboard/);
  assert.match(users, /\/api\/admin\/users/);
  assert.match(businesses, /\/api\/admin\/businesses/);
  assert.match(dialog, /minLength=\{3\}/);
  assert.match(dialog, /reason\.trim\(\)\.length < 3/);
  assert.match(audit, /\/api\/admin\/audit/);
  assert.match(audit, /Append-only/);
});

void test('existing verification screens remain inside the protected admin route tree', () => {
  const list = read('app/admin/verifications/page.tsx');
  const detail = read('app/admin/verifications/[verificationId]/page.tsx');
  assert.match(list, /AdminVerificationsClient/);
  assert.match(detail, /AdminVerificationDetailClient/);
});
