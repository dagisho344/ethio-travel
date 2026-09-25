import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import test from 'node:test';

const root = process.cwd();
/** @param {string} path */
const read = (path) => readFileSync(join(root, path), 'utf8');

void test('owner trip-share BFF uses fixed paths, UUID checks, strict fields, and authenticated forwarding', () => {
  const helper = read('app/api/trips/[id]/share/share-bff.ts');
  assert.match(helper, /uuidPattern/);
  assert.match(helper, /Unexpected share-link field/);
  assert.match(helper, /tripRouteResponse/);
  assert.match(helper, /expiresAt/);
  assert.doesNotMatch(
    helper,
    /localStorage|sessionStorage|accessToken|refreshToken/,
  );
  for (const path of [
    'app/api/trips/[id]/share/route.ts',
    'app/api/trips/[id]/share/preview/route.ts',
    'app/api/trips/[id]/share/regenerate/route.ts',
    'app/api/trips/[id]/share/revoke/route.ts',
  ]) {
    assert.match(read(path), /shareRouteResponse/, path);
  }
});

void test('public resolver keeps the token in a body-only fixed endpoint with no-store controls', () => {
  const source = read('app/api/trip-shares/resolve/route.ts');
  assert.match(source, /validateSameOrigin\(request\)/);
  assert.match(source, /tokenPattern/);
  assert.match(source, /backendJson<unknown>\('\/trip-shares\/resolve'/);
  assert.match(source, /Cache-Control.*no-store/);
  assert.match(source, /Referrer-Policy/);
  assert.match(source, /X-Robots-Tag/);
  assert.doesNotMatch(
    source,
    /authenticatedBackendJson|localStorage|sessionStorage/,
  );
});

void test('shared-trip page clears fragment secrets and renders only the safe shared projection', () => {
  const page = read('app/shared-trip/page.tsx');
  const client = read('components/trips/SharedTripClient.tsx');
  assert.match(page, /force-dynamic/);
  assert.match(page, /index: false/);
  assert.match(page, /referrer: 'no-referrer'/);
  assert.match(client, /window\.location\.hash\.slice\(1\)/);
  assert.match(client, /window\.history\.replaceState/);
  assert.match(client, /\/api\/trip-shares\/resolve/);
  assert.doesNotMatch(
    client,
    /budget|booking|notes|localStorage|sessionStorage/,
  );
});

void test('owner UI requires exact preview and explicit confirmation before one-time link generation', () => {
  const source = read('components/trips/TripSharePanel.tsx');
  assert.match(source, /\/share\/preview/);
  assert.match(source, /I reviewed this exact filtered itinerary/);
  assert.match(source, /disabled=\{busy \|\| !confirmed\}/);
  assert.match(source, /\/shared-trip#\$\{secret\.token\}/);
  assert.match(source, /navigator\.clipboard\.writeText/);
  assert.match(source, /regenerate \? '\/regenerate' : ''/);
  assert.match(source, /\/share\/revoke/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});
