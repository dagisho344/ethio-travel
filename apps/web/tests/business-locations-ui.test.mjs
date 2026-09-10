import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('location BFF routes use the server session, validate mutations, and do not expose tokens', () => {
  const helper = read(
    'app/api/businesses/manage/[businessId]/locations/bff.ts',
  );
  assert.match(helper, /authenticatedBackendJson/);
  assert.match(helper, /validateSameOrigin\(request\)/);
  assert.match(helper, /nullableTextKeys/);
  assert.doesNotMatch(
    helper,
    /accessToken|refreshToken|localStorage|sessionStorage/,
  );

  for (const path of [
    'app/api/businesses/manage/[businessId]/locations/route.ts',
    'app/api/businesses/manage/[businessId]/locations/[locationId]/route.ts',
    'app/api/businesses/manage/[businessId]/locations/[locationId]/make-primary/route.ts',
    'app/api/businesses/manage/[businessId]/locations/[locationId]/archive/route.ts',
    'app/api/businesses/manage/[businessId]/locations/[locationId]/hours/route.ts',
  ]) {
    const source = read(path);
    assert.match(source, /locationResponse/);
    assert.doesNotMatch(
      source,
      /accessToken|refreshToken|localStorage|sessionStorage/,
    );
  }
});

void test('location workspace renders server-authorized controls and cascading real location selectors', () => {
  const source = read('components/businesses/BusinessLocationsClient.tsx');
  assert.match(source, /getManagedBusiness/);
  assert.match(source, /canEditBusiness/);
  assert.match(source, /Staff members have read-only access/);
  assert.match(source, /makeLocationPrimary/);
  assert.match(source, /archiveLocation/);
  assert.match(source, /saveLocationHours/);
  assert.match(source, /'\/regions'/);
  assert.match(source, /'\/cities'/);
  assert.match(source, /\/destinations/);
  assert.match(
    source,
    /regionId: e\.target\.value,\s*cityId: '',\s*destinationId: ''/,
  );
  assert.match(source, /cityId: e\.target\.value,\s*destinationId: ''/);
  assert.match(source, /sm:grid-cols-\[6rem_auto_minmax\(0,1fr\)\]/);
  assert.doesNotMatch(
    source,
    /accessToken|refreshToken|localStorage|sessionStorage/,
  );
});

void test('workspace uses actual primary location records for setup progress', () => {
  const source = read('components/businesses/BusinessWorkspaceClient.tsx');
  assert.match(source, /getLocations\(businessId\)/);
  assert.match(source, /location\.isPrimary && location\.status === 'ACTIVE'/);
  assert.match(source, /hasPrimaryLocation/);
  assert.match(source, /\/businesses\/manage\/\$\{business\.id\}\/locations/);
});
