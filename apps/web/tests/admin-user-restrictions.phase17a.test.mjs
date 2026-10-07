/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- vm-transpiled route exports and mocked modules are runtime-checked below. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = join(import.meta.dirname, '..');
const userId = '11111111-1111-4111-8111-111111111111';

/** @param {string} path */
const read = (path) => readFileSync(join(root, path), 'utf8');

/** @param {string} path @param {(name:string)=>unknown} imports */
function execute(path, imports = () => ({})) {
  const compiled = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  /** @type {Record<string,unknown>} */ const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: imports,
    Date,
    Set,
    JSON,
    URLSearchParams,
  });
  return exports;
}

class BffAuthError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function harness() {
  /** @type {Array<{path:string,init:RequestInit}>} */ const calls = [];
  let sameOrigin = true;
  let backendStatus = 0;
  let cleared = 0;
  const bff = execute('app/api/admin/bff.ts', (name) => {
    if (name === 'next/server') {
      return { NextResponse: { json: (data) => ({ status: 200, data }) } };
    }
    if (name === '../../../lib/auth/session') {
      return {
        BffAuthError,
        authenticatedBackendJson: (path, init) => {
          calls.push({ path, init });
          if (backendStatus)
            throw new BffAuthError(backendStatus, 'Backend denied');
          return { data: { ok: true } };
        },
        clearAuthCookies: () => {
          cleared++;
        },
        jsonError: (error) => ({
          status: error.status ?? 500,
          message: error.message,
        }),
        setAuthCookies: () => {},
        validateSameOrigin: () => {
          if (!sameOrigin) throw new BffAuthError(403, 'Origin denied');
        },
      };
    }
    throw new Error(`Unexpected import ${name}`);
  });
  const restrictions = execute(
    'app/api/admin/users/[userId]/restrictions/route.ts',
    () => bff,
  );
  const lift = execute(
    'app/api/admin/users/[userId]/restrictions/[capability]/lift/route.ts',
    () => bff,
  );
  /** @param {unknown} body */
  const request = (body) => ({ json: () => Promise.resolve(body) });
  return {
    bff,
    calls,
    restrictions,
    lift,
    request,
    get cleared() {
      return cleared;
    },
    set sameOrigin(value) {
      sameOrigin = value;
    },
    set backendStatus(value) {
      backendStatus = value;
    },
  };
}

void test('GET restrictions validates UUID and forwards through the Admin session BFF', async () => {
  const h = harness();
  const response = await h.restrictions.GET(h.request(null), {
    params: Promise.resolve({ userId }),
  });
  assert.equal(response.status, 200);
  assert.equal(h.calls[0].path, `/admin/users/${userId}/restrictions`);
  const invalid = await h.restrictions.GET(h.request(null), {
    params: Promise.resolve({ userId: '../admin' }),
  });
  assert.equal(invalid.status, 404);
  assert.equal(h.calls.length, 1);
});

void test('restrict accepts all five allowlisted capabilities and the 1-character backend reason minimum', async () => {
  const h = harness();
  const capabilities = [
    'BOOKING',
    'REVIEW',
    'MESSAGING',
    'BUSINESS_MANAGEMENT',
    'PAYMENT_PROOF_SUBMISSION',
  ];
  for (const capability of capabilities) {
    const response = await h.restrictions.POST(
      h.request({ capability, reason: ' x ' }),
      { params: Promise.resolve({ userId }) },
    );
    assert.equal(response.status, 200);
    assert.equal(h.calls.at(-1).path, `/admin/users/${userId}/restrictions`);
    assert.deepEqual(JSON.parse(h.calls.at(-1).init.body), {
      capability,
      reason: 'x',
    });
  }
});

void test('restrict forwards a future offset expiry and rejects unknown fields, invalid values and path injection', async () => {
  const h = harness();
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const params = { params: Promise.resolve({ userId }) };
  assert.equal(
    (
      await h.restrictions.POST(
        h.request({
          capability: 'BOOKING',
          reason: 'Reason',
          expiresAt: future,
        }),
        params,
      )
    ).status,
    200,
  );
  assert.equal(JSON.parse(h.calls.at(-1).init.body).expiresAt, future);
  for (const body of [
    { capability: 'BOOKING', reason: 'x', status: 'ACTIVE' },
    { capability: '../../users', reason: 'x' },
    { capability: 'BOOKING', reason: '  ' },
    { capability: 'BOOKING', reason: 'x'.repeat(1001) },
    { capability: 'BOOKING', reason: 'x', expiresAt: '2026-10-05T12:00' },
    { capability: 'BOOKING', reason: 'x', expiresAt: '2020-01-01T12:00:00Z' },
    { capability: 'BOOKING', reason: 'x', expiresAt: '2030-02-30T12:00:00Z' },
  ]) {
    assert.equal(
      (await h.restrictions.POST(h.request(body), params)).status,
      400,
    );
  }
  assert.equal(h.calls.length, 1);
  assert.equal(
    (
      await h.restrictions.POST(
        h.request({ capability: 'BOOKING', reason: 'x' }),
        { params: Promise.resolve({ userId: 'bad/id' }) },
      )
    ).status,
    404,
  );
});

void test('lift validates capability, UUID and a strictly allowlisted 1–1000 character reason', async () => {
  const h = harness();
  const params = { params: Promise.resolve({ userId, capability: 'BOOKING' }) };
  assert.equal(
    (await h.lift.POST(h.request({ reason: ' x ' }), params)).status,
    200,
  );
  assert.equal(
    h.calls[0].path,
    `/admin/users/${userId}/restrictions/BOOKING/lift`,
  );
  assert.deepEqual(JSON.parse(h.calls[0].init.body), { reason: 'x' });
  for (const body of [
    { reason: ' ' },
    { reason: 'x'.repeat(1001) },
    { reason: 'x', liftedAt: 'now' },
  ]) {
    assert.equal((await h.lift.POST(h.request(body), params)).status, 400);
  }
  assert.equal(
    (
      await h.lift.POST(h.request({ reason: 'x' }), {
        params: Promise.resolve({ userId, capability: '../BOOKING' }),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await h.lift.POST(h.request({ reason: 'x' }), {
        params: Promise.resolve({ userId: 'not-uuid', capability: 'BOOKING' }),
      })
    ).status,
    404,
  );
  assert.equal(h.calls.length, 1);
});

void test('mutations keep same-origin protection; backend errors propagate and 401 clears auth cookies', async () => {
  const h = harness();
  h.sameOrigin = false;
  assert.equal(
    (
      await h.restrictions.POST(
        h.request({ capability: 'BOOKING', reason: 'x' }),
        { params: Promise.resolve({ userId }) },
      )
    ).status,
    403,
  );
  assert.equal(h.calls.length, 0);
  h.sameOrigin = true;
  for (const status of [401, 403, 404, 409]) {
    h.backendStatus = status;
    const result = await h.restrictions.POST(
      h.request({ capability: 'BOOKING', reason: 'x' }),
      { params: Promise.resolve({ userId }) },
    );
    assert.equal(result.status, status);
  }
  assert.equal(h.cleared, 1);
});

void test('restriction presentation uses the backend active flag and converts local expiry to explicit UTC', () => {
  const admin = execute('lib/admin.ts');
  const state = admin.restrictionState;
  assert.equal(state(undefined), 'unrestricted');
  assert.equal(state({ active: true, liftedAt: null }), 'active');
  assert.equal(state({ active: false, liftedAt: null }), 'expired');
  assert.equal(
    state({ active: false, liftedAt: '2026-01-01T00:00:00Z' }),
    'lifted',
  );
  const actions = admin.restrictionActions;
  assert.equal(actions('ACTIVE', false, undefined).canRestrict, true);
  assert.equal(actions('ACTIVE', true, undefined).canRestrict, false);
  assert.equal(actions('SUSPENDED', false, undefined).canRestrict, false);
  assert.equal(actions('DEACTIVATED', false, undefined).canRestrict, false);
  assert.equal(
    actions('SUSPENDED', false, { active: true, liftedAt: null }).canLift,
    true,
  );
  assert.equal(
    actions('ACTIVE', false, { active: false, liftedAt: null }).canRestrict,
    true,
  );
  const iso = admin.localExpiryToIso(
    '2030-01-01T12:00',
    new Date('2026-01-01T00:00:00Z'),
  );
  assert.match(iso, /Z$/);
  assert.equal(
    admin.localExpiryToIso('2026-01-01T00:00', new Date('2026-01-01T00:00')),
    null,
  );
  assert.equal(admin.localExpiryToIso('not-a-date'), null);
  assert.equal(
    admin.localExpiryToIso(
      '2030-02-30T12:00',
      new Date('2026-01-01T00:00:00Z'),
    ),
    null,
  );
});

void test('detail UI includes all capability cards, target rules, accessible dialogs and deferred payment-proof note', () => {
  const detail = read('app/admin/users/[userId]/AdminUserDetailClient.tsx');
  const component = read('components/admin/AdminUserRestrictions.tsx');
  assert.match(detail, /<AdminUserRestrictions/);
  assert.match(component, /ADMIN_RESTRICTION_CAPABILITIES\.map/);
  assert.match(component, /row\.active|restrictionState\(row\)/);
  assert.match(component, /status === 'ACTIVE' && !isAdmin/);
  assert.match(component, /restrictionActions\(status, isAdmin, row\)/);
  assert.match(component, /paymentProofDeferred/);
  assert.match(component, /localExpiryToIso\(localExpiry\)/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /noValidate/);
  assert.match(component, /event\.key === 'Escape'/);
  assert.match(component, /event\.stopPropagation\(\)/);
  assert.match(component, /event\.key !== 'Tab'/);
  assert.match(component, /sm:grid-cols-2/);
  assert.match(component, /overflow-wrap:anywhere/);
  assert.doesNotMatch(component, /passwordHash|localStorage|sessionStorage/);
});

void test('English and Amharic restriction catalogs have matching, non-empty keys', () => {
  const en = JSON.parse(read('messages/en.json')).adminUserRestrictions;
  const am = JSON.parse(read('messages/am.json')).adminUserRestrictions;
  assert.deepEqual(Object.keys(en).sort(), Object.keys(am).sort());
  for (const value of Object.values(am)) {
    assert.equal(typeof value, 'string');
    assert.ok(value.length > 0);
  }
  assert.match(am.heading, /[\u1200-\u137f]/);
  assert.match(am.paymentProofDeferred, /[\u1200-\u137f]/);
});
