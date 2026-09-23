import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('header has the requested main and Others navigation order without Demo', () => {
  const layout = read('components/layout/PublicLayout.tsx');
  const navigation = read('components/layout/HeaderNavigation.tsx');
  const mainLabels = [
    'Home',
    'Explore',
    'Destinations',
    'Businesses',
    'Services',
  ];
  const otherLabels = [
    'Search',
    'Map',
    'Hotels',
    'Restaurants',
    'Tours',
    'Transport',
  ];

  let previousIndex = layout.indexOf('const publicLinks');
  for (const label of mainLabels) {
    const index = layout.indexOf(`label: '${label}'`, previousIndex);
    assert.ok(
      index > previousIndex,
      `${label} should follow the preceding main item`,
    );
    previousIndex = index;
  }

  previousIndex = layout.indexOf('const otherPublicLinks');
  for (const label of otherLabels) {
    const index = layout.indexOf(`label: '${label}'`, previousIndex);
    assert.ok(
      index > previousIndex,
      `${label} should follow the preceding Others item`,
    );
    previousIndex = index;
  }

  assert.match(layout, /href: '\/search', label: 'Explore'/);
  assert.match(layout, /href: '\/search\?view=map', label: 'Map'/);
  assert.doesNotMatch(layout, /const authenticatedLinks/);
  assert.match(navigation, /const navigationLinks = publicLinks/);
  assert.match(navigation, /href="\/login"/);
  assert.match(navigation, /href="\/register"/);
  assert.match(navigation, /Join EthioTravel/);
  assert.match(navigation, /hidden items-center gap-2 lg:flex/);
  assert.ok(
    navigation.indexOf('href="/login"') >
      navigation.indexOf('aria-label="Primary navigation"'),
    'desktop guest actions should follow the main navigation',
  );
  assert.doesNotMatch(layout, /href="\/login"/);
  assert.doesNotMatch(layout, /Demo/);
});

void test('Others is an accessible desktop dropdown with a working mobile submenu', () => {
  const navigation = read('components/layout/HeaderNavigation.tsx');

  assert.match(navigation, /aria-controls="other-navigation-menu"/);
  assert.match(navigation, /aria-expanded=\{othersOpen\}/);
  assert.match(navigation, /aria-controls="mobile-other-navigation"/);
  assert.match(navigation, /aria-expanded=\{mobileOthersOpen\}/);
  assert.match(navigation, /setOthersOpen\(false\)/);
  assert.match(navigation, /setMobileOthersOpen\(false\)/);
  assert.match(navigation, /event\.key !== 'Escape'/);
  assert.match(navigation, /othersRef\.current/);
  assert.match(navigation, /mobileRef\.current/);
  assert.match(navigation, /otherPublicLinks\.map\(\(link\) => \(/);
  assert.doesNotMatch(navigation, /businessOnboardingHref/);
  assert.doesNotMatch(navigation, />Register</);
});

void test('shared account navigation keeps account routes separate and supports accessible dismissal', () => {
  const navigation = read('components/layout/HeaderNavigation.tsx');
  const accountDropdown = read('components/layout/AccountDropdown.tsx');
  const accountLabels = [
    'My Profile',
    'My Trips',
    'AI Assistant',
    'Messages',
    'My Bookings',
    'Favorites',
    'My Reviews',
  ];

  let previousIndex = -1;
  for (const label of accountLabels) {
    const index = accountDropdown.indexOf(`label: '${label}'`);
    assert.ok(
      index > previousIndex,
      `${label} should follow the preceding account item`,
    );
    previousIndex = index;
  }
  assert.match(navigation, /<AccountDropdown/);
  assert.match(navigation, /<MobileAccountNavigation/);
  assert.match(navigation, /mobileAccountOpen/);
  assert.match(navigation, /mobileAccountButtonRef\.current\?\.focus\(\)/);
  assert.match(navigation, /max-h-\[calc\(100dvh-5rem\)\].*overflow-y-auto/);
  assert.match(accountDropdown, /accountNavigationLinks/);
  assert.match(
    accountDropdown,
    /hasBusinessWorkspace\s*\? \[\{ href: '\/businesses\/manage', label: 'Business Dashboard' \}\]/,
  );
  assert.match(navigation, /NotificationBell/);
  assert.match(accountDropdown, /LogoutButton/);
  assert.match(navigation, /pointerdown/);
  assert.match(accountDropdown, /event\.key !== 'Escape'/);
  assert.match(accountDropdown, /dropdownRef\.current/);
  assert.match(accountDropdown, /buttonRef\.current\?\.focus\(\)/);
  assert.match(accountDropdown, /aria-expanded=\{open\}/);
  assert.match(accountDropdown, /aria-haspopup="menu"/);
  assert.match(accountDropdown, /Mobile account navigation/);
  assert.match(accountDropdown, /aria-expanded=\{open\}/);
  assert.match(accountDropdown, /onOpenChange\(false\)/);
  assert.doesNotMatch(accountDropdown, /href: '\/admin\/payments'/);
  assert.match(accountDropdown, /flex w-56.*flex-col items-stretch/);
  assert.match(accountDropdown, /block w-full rounded-md/);
});

void test('only a server-derived ADMIN role adds Admin Dashboard to both account menus', () => {
  const layout = read('components/layout/PublicLayout.tsx');
  const accountDropdown = read('components/layout/AccountDropdown.tsx');

  assert.match(layout, /session\.user\?\.roles\.includes\('ADMIN'\) === true/);
  assert.match(accountDropdown, /hasAdminDashboard/);
  assert.match(
    accountDropdown,
    /hasAdminDashboard\s*\? \[\{ href: '\/admin', label: 'Admin Dashboard' \}\]/,
  );
  assert.match(accountDropdown, /\{links\.map\(\(link\) => \(/);
  assert.doesNotMatch(accountDropdown, /href: '\/admin\/payments'/);
});
