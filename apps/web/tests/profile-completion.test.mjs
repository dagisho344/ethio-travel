import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('My Profile is a cookie-gated account page with a safe login handoff', () => {
  const page = read('app/account/page.tsx');
  const navigation = read('components/layout/AccountDropdown.tsx');

  assert.match(page, /currentTokens\(\)/);
  assert.match(page, /redirect\('\/login\?returnTo=%2Faccount'\)/);
  assert.match(page, /<AccountProfileClient\s*\/>/);
  assert.match(navigation, /href: '\/account', label: t\('profile'\)/);
});

void test('the account BFF has a fixed self-only backend path and a strict profile allowlist', () => {
  const route = read('app/api/account/route.ts');

  assert.match(route, /const profileFieldLimits = \{/);
  assert.match(route, /firstName: 100/);
  assert.match(route, /lastName: 100/);
  assert.match(route, /phone: 32/);
  assert.match(route, /validateSameOrigin\(request\)/);
  assert.match(route, /authenticatedBackendJson<SafeUser>\(path, init\)/);
  assert.match(route, /accountResponse\('\/users\/me'\)/);
  assert.match(route, /accountResponse\('\/users\/me', \{/);
  assert.match(route, /method: 'PATCH'/);
  assert.match(route, /isProfileField\(key\)/);
  assert.match(route, /Profile field \$\{key\} is not allowed/);
  assert.match(route, /typeof value !== 'string'/);
  assert.match(route, /clearAuthCookies\(response\)/);
  assert.doesNotMatch(route, /avatarUrl/);
  assert.doesNotMatch(route, /userId/);
  assert.doesNotMatch(route, /accessToken|refreshToken/);
});

void test('profile editing has accessible loading, retry, error, success, and duplicate-submit states', () => {
  const client = read('components/account/AccountProfileClient.tsx');

  assert.match(client, /bffJson<ProfileUser>\('\/api\/account'\)/);
  assert.match(client, /method: 'PATCH'/);
  assert.match(client, /router\.replace\('\/login\?returnTo=%2Faccount'\)/);
  assert.match(client, /activeRequest !== requestId\.current/);
  assert.match(client, /disabled=\{saving \|\| !hasChanges\}/);
  assert.match(client, /Saving changes\.\.\./);
  assert.match(client, /Your profile has been updated\./);
  assert.match(client, /Retry/);
  assert.match(client, /readOnly/);
  assert.match(client, /Authorized roles/);
  assert.match(client, /Profile photos are not available yet/);
  assert.doesNotMatch(client, /localStorage|sessionStorage|avatarUrl/);
});
