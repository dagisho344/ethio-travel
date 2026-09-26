import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('route-aware chrome preserves public pages and replaces marketplace chrome inside the business portal', () => {
  const publicLayout = read('components/layout/PublicLayout.tsx');
  const chrome = read('components/layout/RouteAwareChrome.tsx');
  const portal = read('components/layout/BusinessPortalTopBar.tsx');
  const accountDropdown = read('components/layout/AccountDropdown.tsx');

  assert.match(publicLayout, /RouteAwareChrome/);
  assert.match(chrome, /pathname === '\/businesses\/manage'/);
  assert.match(chrome, /pathname\.startsWith\('\/businesses\/manage\/'\)/);
  assert.match(chrome, /isBusinessPortal \? null : footer/);
  assert.match(chrome, /isBusinessPortal \?[\s(]*<BusinessPortalTopBar/);
  assert.match(portal, /useTranslations\('portal'\)/);
  assert.match(portal, /t\('business'\)/);
  assert.match(portal, /NotificationBell/);
  assert.match(portal, /AccountDropdown/);
  assert.doesNotMatch(portal, /LogoutButton/);
  assert.match(accountDropdown, /LogoutButton/);
  assert.match(chrome, /hasBusinessWorkspace/);
  assert.match(portal, /t\('back'\)/);
});

void test('nested shell provides all real workspace routes, active links, mobile drawer, and server-authorized switcher', () => {
  const layout = read('app/businesses/manage/[businessId]/layout.tsx');
  const shell = read('components/businesses/BusinessWorkspaceShell.tsx');

  assert.match(layout, /currentTokens/);
  assert.match(layout, /BusinessWorkspaceShell/);
  for (const label of [
    'Overview',
    'Profile',
    'Locations',
    'Services',
    'Availability',
    'Bookings',
    'Customers',
    'Messages',
    'Reviews',
    'Payments',
    'Media',
    'Verification',
    'Settings',
    'All Businesses',
    'Back to EthioTravel',
  ]) {
    assert.match(shell, new RegExp(`label: '${label}'|${label}`));
  }
  assert.match(shell, /aria-current=\{active \? 'page' : undefined\}/);
  assert.match(shell, /getManagedBusinesses/);
  assert.match(shell, /BusinessSwitcher/);
  assert.match(shell, /business-workspace-drawer/);
  assert.match(shell, /aria-modal="true"/);
  assert.match(shell, /event\.key !== 'Escape'/);
});

void test('overview contains operational dashboard content while profile editing is isolated to the profile route', () => {
  const overview = read('components/businesses/BusinessWorkspaceClient.tsx');
  const dashboard = read('components/businesses/BusinessDashboardOverview.tsx');
  const profile = read('components/businesses/BusinessProfileEditor.tsx');
  const profilePage = read(
    'app/businesses/manage/[businessId]/profile/page.tsx',
  );

  assert.doesNotMatch(overview, /BusinessProfileEditor|Edit profile/);
  assert.match(overview, /BusinessDashboardOverview/);
  assert.match(profile, /export function BusinessProfileEditor/);
  assert.match(
    profile,
    /Staff members can view this workspace but cannot change business details/,
  );
  assert.match(
    profile,
    /regionId: event\.target\.value,[\s\S]*cityId: '',[\s\S]*destinationId: ''/,
  );
  assert.match(profilePage, /BusinessProfileClient/);
  assert.match(dashboard, /Needs your attention/);
  assert.match(dashboard, /Business setup/);
  assert.match(dashboard, /role="progressbar"/);
  assert.match(dashboard, /No captured revenue yet/);
  assert.match(dashboard, /canManage/);
});

void test('workspace status UX uses real setup, suspension, and verification state', () => {
  const shell = read('components/businesses/BusinessWorkspaceShell.tsx');
  const dashboard = read('components/businesses/BusinessDashboardOverview.tsx');

  assert.match(shell, /business\?\.status === 'SUSPENDED'/);
  assert.match(
    shell,
    /hidden[\s\S]*from public discovery and cannot receive new bookings/,
  );
  for (const state of ['NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED']) {
    assert.match(shell, new RegExp(`'${state}'`));
  }
  assert.match(dashboard, /activeMediaCount/);
  assert.match(dashboard, /serviceCount/);
  assert.match(dashboard, /\/verification/);
  assert.match(dashboard, /\/media/);
});

void test('business selector and availability index retain real data sources and strong actions', () => {
  const selector = read('components/businesses/MyBusinessesClient.tsx');
  const availability = read(
    'components/businesses/BusinessAvailabilityIndexClient.tsx',
  );
  const availabilityPage = read(
    'app/businesses/manage/[businessId]/availability/page.tsx',
  );

  assert.match(selector, /getManagedBusinesses/);
  assert.match(selector, /Add another business/);
  assert.match(selector, /Open Dashboard/);
  assert.match(selector, /No businesses yet/);
  assert.match(availability, /getManagedServices/);
  assert.match(availability, /services\/\$\{service\.id\}\/availability/);
  assert.match(availabilityPage, /BusinessAvailabilityIndexClient/);
});

void test('business portal UI keeps authentication credentials outside browser storage', () => {
  for (const path of [
    'components/layout/BusinessPortalTopBar.tsx',
    'components/layout/RouteAwareChrome.tsx',
    'components/businesses/BusinessWorkspaceShell.tsx',
    'components/businesses/BusinessProfileEditor.tsx',
    'components/businesses/BusinessAvailabilityIndexClient.tsx',
  ]) {
    assert.doesNotMatch(
      read(path),
      /localStorage|sessionStorage|accessToken|refreshToken/,
      path,
    );
  }
});
