import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('business onboarding and workspace pages require an HttpOnly-backed session with safe return targets', () => {
  for (const path of [
    'app/business/onboarding/page.tsx',
    'app/businesses/manage/page.tsx',
    'app/businesses/manage/[businessId]/page.tsx',
  ]) {
    const source = read(path);
    assert.match(source, /currentTokens/);
    assert.match(source, /redirect\('/);
  }
  assert.match(
    read('components/layout/HeaderNavigation.tsx'),
    /returnTo=%2Fbusiness%2Fonboarding/,
  );
});

void test('business BFF routes use server-side authentication, same-origin mutations, and no owner input', () => {
  const bff = read('app/api/businesses/manage/bff.ts');
  const createRoute = read('app/api/businesses/manage/route.ts');
  const detailRoute = read('app/api/businesses/manage/[businessId]/route.ts');
  assert.match(bff, /authenticatedBackendJson/);
  assert.match(bff, /validateSameOrigin/);
  assert.match(createRoute, /'\/businesses'/);
  assert.match(createRoute, /jsonError/);
  assert.match(detailRoute, /\/my\/businesses\/\$\{businessId\}/);
  assert.doesNotMatch(
    bff,
    /ownerUserId|recipientUserId|accessToken|refreshToken/,
  );
});

void test('onboarding uses real cascading data, validates fields, and protects against duplicate drafts', () => {
  const source = read('components/businesses/BusinessOnboardingWizard.tsx');
  assert.match(source, /'\/regions'/);
  assert.match(source, /'\/cities'/);
  assert.match(source, /'\/business-categories'/);
  assert.match(source, /\/destinations/);
  assert.match(
    source,
    /regionId: event\.target\.value,\s*cityId: '',\s*destinationId: ''/,
  );
  assert.match(source, /cityId: event\.target\.value,\s*destinationId: ''/);
  assert.match(source, /createBusinessDraft/);
  assert.match(source, /disabled=\{submitting \|\| loadingOptions\}/);
  assert.match(source, /localStorage\.removeItem\(storageKey\)/);
  assert.doesNotMatch(source, /accessToken|refreshToken|password/);
});

void test('workspace and My Businesses present server-authorized membership status and respect staff read-only access', () => {
  const workspace = read('components/businesses/BusinessWorkspaceClient.tsx');
  const list = read('components/businesses/MyBusinessesClient.tsx');
  assert.match(workspace, /getManagedBusiness/);
  assert.match(workspace, /canEditBusiness/);
  assert.match(
    workspace,
    /Staff members can view this workspace but cannot change business details/,
  );
  assert.match(workspace, /Verification has not been submitted/);
  assert.match(list, /currentMember\.role/);
  assert.match(list, /nextBusinessAction/);
});

void test('business management helpers do not put credentials in browser storage', () => {
  const source = read('lib/business-management.ts');
  assert.doesNotMatch(
    source,
    /localStorage|sessionStorage|accessToken|refreshToken/,
  );
});
