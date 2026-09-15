import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('business workspace eligibility combines global role hints with active membership', () => {
  const session = read('lib/auth/session.ts');
  const loginRoute = read('app/api/auth/login/route.ts');

  assert.match(session, /'BUSINESS_OWNER'/);
  assert.match(session, /'BUSINESS_STAFF'/);
  assert.match(session, /\/my\/businesses\?page=1&limit=1/);
  assert.match(
    session,
    /Array\.isArray\(page\.data\) && page\.data\.length > 0/,
  );
  assert.match(session, /hasBusinessWorkspaceWithBackend/);
  assert.match(loginRoute, /hasBusinessWorkspaceWithBackend\(/);
  assert.match(loginRoute, /hasBusinessWorkspace,/);
  assert.doesNotMatch(loginRoute, /NextResponse\.json\([^)]*accessToken/s);
  assert.doesNotMatch(loginRoute, /NextResponse\.json\([^)]*refreshToken/s);
});

void test('business dashboard navigation is safe and shared by desktop and mobile account menus', () => {
  const layout = read('components/layout/PublicLayout.tsx');
  const navigation = read('components/layout/HeaderNavigation.tsx');

  assert.match(
    layout,
    /hasBusinessWorkspace=\{session\.hasBusinessWorkspace\}/,
  );
  assert.match(navigation, /hasBusinessWorkspace: boolean/);
  assert.match(navigation, /authenticated && hasBusinessWorkspace/);
  assert.match(
    navigation,
    /href: '\/businesses\/manage', label: 'Business Dashboard'/,
  );
  assert.equal((navigation.match(/accountLinks\.map/g) ?? []).length, 2);
  assert.match(navigation, /role="menuitem"/);
  assert.match(navigation, /Mobile primary navigation/);
  assert.match(navigation, /\.\.\.standardAccountLinks/);
});

void test('login default keeps explicit safe returns ahead of workspace eligibility', () => {
  const form = read('components/auth/AuthForm.tsx');
  const workspace = read('app/businesses/manage/page.tsx');

  assert.match(form, /function parseAuthRouteResponse\(value: unknown\)/);
  assert.match(
    form,
    /hasBusinessWorkspace: value\.hasBusinessWorkspace === true/,
  );
  assert.match(
    form,
    /auth\.hasBusinessWorkspace \? '\/businesses\/manage' : '\/explore'/,
  );
  assert.match(form, /hasSafeReturnTo\(returnTo\)/);
  assert.match(
    form,
    /\? safeReturnTo\(returnTo\)\s*: defaultLoginDestination\(auth\)/s,
  );
  assert.doesNotMatch(
    form,
    /localStorage|sessionStorage|accessToken|refreshToken/,
  );
  assert.match(workspace, /currentTokens/);
  assert.match(workspace, /!tokens\.accessToken && !tokens\.refreshToken/);
  assert.match(
    workspace,
    /redirect\('\/login\?returnTo=\/businesses\/manage'\)/,
  );
});
