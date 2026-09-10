import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('header has the requested authenticated navigation order without Demo', () => {
  const layout = read('components/layout/PublicLayout.tsx');
  const expectedLabels = [
    'Home',
    'Explore',
    'Destinations',
    'Businesses',
    'Services',
    'My Trips',
    'Messages',
    'AI Assistant',
  ];

  let previousIndex = -1;
  for (const label of expectedLabels) {
    const index = layout.indexOf(`label: '${label}'`);
    assert.ok(
      index > previousIndex,
      `${label} should follow the preceding navigation item`,
    );
    previousIndex = index;
  }
  assert.doesNotMatch(layout, /Demo/);
});

void test('profile menu keeps account routes separate and supports accessible dismissal', () => {
  const navigation = read('components/layout/HeaderNavigation.tsx');
  const accountLabels = ['My Bookings', 'Favorites', 'My Reviews', 'Account'];

  let previousIndex = -1;
  for (const label of accountLabels) {
    const index = navigation.indexOf(`label: '${label}'`);
    assert.ok(
      index > previousIndex,
      `${label} should follow the preceding account item`,
    );
    previousIndex = index;
  }
  assert.match(navigation, /NotificationBell/);
  assert.match(navigation, /LogoutButton/);
  assert.match(navigation, /pointerdown/);
  assert.match(navigation, /event\.key !== 'Escape'/);
  assert.doesNotMatch(navigation, /href: '\/admin\/payments'/);
  assert.match(navigation, /flex w-52.*flex-col items-stretch/);
  assert.match(navigation, /block w-full text-left/);
});
