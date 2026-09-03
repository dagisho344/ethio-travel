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

void test('auth session cookies are HttpOnly with production-safe attributes', () => {
  const source = read('lib/auth/session.ts');
  assert.match(source, /httpOnly:\s*true/);
  assert.match(source, /sameSite:\s*'lax'/);
  assert.match(source, /secure:\s*process\.env\.NODE_ENV === 'production'/);
  assert.match(source, /path:\s*'\/'/);
});

void test('state-changing auth routes validate same-origin requests', () => {
  const source = read('lib/auth/session.ts');
  assert.match(source, /validateSameOrigin/);
  assert.match(source, /request\.headers\.get\('origin'\)/);
  assert.match(source, /origin !== request\.nextUrl\.origin/);
});

void test('browser-visible auth route responses do not expose refresh tokens', () => {
  for (const path of [
    'app/api/auth/login/route.ts',
    'app/api/auth/register/route.ts',
    'app/api/auth/refresh/route.ts',
    'app/api/auth/me/route.ts',
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /NextResponse\.json\([^)]*refreshToken/s, path);
    assert.doesNotMatch(source, /NextResponse\.json\([^)]*accessToken/s, path);
  }
});

void test('frontend does not use browser storage for auth tokens', () => {
  for (const path of [
    'components/auth/AuthForm.tsx',
    'components/auth/LogoutButton.tsx',
    'lib/auth/session.ts',
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /localStorage|sessionStorage/, path);
  }
});
