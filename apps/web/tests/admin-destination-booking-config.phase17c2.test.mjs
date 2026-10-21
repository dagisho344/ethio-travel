/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- VM-loaded route exports and synthetic JSX nodes are checked at runtime. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { setImmediate as nextTick } from 'node:timers/promises';
import vm from 'node:vm';
import ts from 'typescript';

const root = join(import.meta.dirname, '..');
const destinationId = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';
const read = (path) => readFileSync(join(root, path), 'utf8');

/** @param {string} path @param {(name:string)=>unknown} imports */
function execute(path, imports) {
  const compiled = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  /** @type {Record<string,unknown>} */ const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: imports,
    JSON,
    Object,
    Number,
    Set,
    Headers,
    Date,
    Intl,
    TextDecoder,
    TextEncoder,
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

class MockResponse {
  /** @param {unknown} body @param {number} [status] */
  constructor(body, status = 200) {
    this.body = body;
    this.status = status;
    this.headers = new Headers();
  }
}

function harness() {
  /** @type {Array<{path:string,init:RequestInit}>} */ const calls = [];
  let originAllowed = true;
  let upstreamStatus = 200;
  const admin = {
    adminUuid: (value) => {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          value,
        )
      )
        throw new BffAuthError(404, 'Not found');
      return value;
    },
    adminError: (error) =>
      new MockResponse({ message: error.message }, error.status ?? 500),
    adminJson: (_request, path, init = {}) => {
      if (init.method && init.method !== 'GET' && !originAllowed)
        return new MockResponse({ message: 'Origin denied' }, 403);
      calls.push({ path, init });
      return new MockResponse(
        upstreamStatus === 200
          ? { ok: true }
          : { message: 'Upstream rejected' },
        upstreamStatus,
      );
    },
  };
  const helper = execute(
    'app/api/admin/destinations/[destinationId]/booking-config/bff.ts',
    (name) => {
      if (name.endsWith('/lib/auth/session')) return { BffAuthError };
      if (name === '../../../bff') return admin;
      throw new Error(`Unexpected import ${name}`);
    },
  );
  const config = execute(
    'app/api/admin/destinations/[destinationId]/booking-config/route.ts',
    (name) => (name === './bff' ? helper : admin),
  );
  const accounts = execute(
    'app/api/admin/destinations/[destinationId]/payment-accounts/route.ts',
    (name) => {
      if (name.endsWith('/lib/auth/session')) return { BffAuthError };
      return helper;
    },
  );
  const account = execute(
    'app/api/admin/destinations/[destinationId]/payment-accounts/[accountId]/route.ts',
    () => helper,
  );
  const deactivate = execute(
    'app/api/admin/destinations/[destinationId]/payment-accounts/[accountId]/deactivate/route.ts',
    () => helper,
  );
  const params = { params: Promise.resolve({ destinationId, accountId }) };
  return {
    config,
    accounts,
    account,
    deactivate,
    params,
    calls,
    set originAllowed(value) {
      originAllowed = value;
    },
    set upstreamStatus(value) {
      upstreamStatus = value;
    },
  };
}

/** @param {unknown} body */
function request(body) {
  return {
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(body === null ? '' : JSON.stringify(body)),
    headers: new Headers(),
    nextUrl: { searchParams: new URLSearchParams() },
  };
}

const draft = {
  bookingEnabled: false,
  priceAmount: '1500.00',
  requestDescription: 'A walking tour request',
  bookingInstructions: null,
};
const payment = {
  provider: 'TELEBIRR',
  accountHolderName: 'Test Holder',
  accountIdentifier: '0912345678',
  instructions: null,
  displayOrder: 0,
};

void test('configuration BFF preserves exact ETB strings and refuses activation, unknown fields and bad IDs', async () => {
  const h = harness();
  const got = await h.config.GET(request(null), h.params);
  assert.equal(got.status, 200);
  assert.equal(got.headers.get('cache-control'), 'no-store');
  const saved = await h.config.PUT(request(draft), h.params);
  assert.equal(saved.status, 200);
  assert.equal(JSON.parse(h.calls[1].init.body).priceAmount, '1500.00');
  assert.equal(JSON.parse(h.calls[1].init.body).bookingEnabled, false);
  for (const invalid of [
    { ...draft, bookingEnabled: true },
    { ...draft, extra: 'x' },
    { ...draft, priceAmount: 1500 },
    { ...draft, priceAmount: '1500.001' },
    { ...draft, priceAmount: '0.00' },
    { ...draft, currency: 'USD' },
  ])
    assert.ok((await h.config.PUT(request(invalid), h.params)).status >= 400);
  assert.equal(h.calls.length, 2);
  assert.equal(
    (
      await h.config.GET(request(null), {
        params: Promise.resolve({ destinationId: '../secret' }),
      })
    ).status,
    404,
  );
});

void test('account BFF handles Telebirr/CBE create, edit and deactivate with scoped paths', async () => {
  const h = harness();
  for (const provider of ['TELEBIRR', 'CBE']) {
    assert.equal(
      (await h.accounts.POST(request({ ...payment, provider }), h.params))
        .status,
      200,
    );
  }
  assert.equal(
    h.calls[0].path,
    `/admin/destinations/${destinationId}/payment-accounts`,
  );
  assert.equal(JSON.parse(h.calls[1].init.body).provider, 'CBE');
  assert.equal(
    (
      await h.account.PATCH(
        request({ accountHolderName: 'Updated', displayOrder: 3 }),
        h.params,
      )
    ).status,
    200,
  );
  assert.equal(
    h.calls[2].path,
    `/admin/destinations/${destinationId}/payment-accounts/${accountId}`,
  );
  assert.equal(
    (await h.account.PATCH(request({ isActive: true }), h.params)).status,
    200,
  );
  assert.equal(JSON.parse(h.calls[3].init.body).isActive, true);
  assert.equal((await h.deactivate.POST(request(null), h.params)).status, 200);
  assert.equal(
    h.calls[4].path,
    `/admin/destinations/${destinationId}/payment-accounts/${accountId}/deactivate`,
  );
  assert.equal(h.calls[4].init.body, '{}');
  assert.equal(
    (await h.accounts.GET(request(null), h.params)).headers.get(
      'cache-control',
    ),
    'no-store',
  );
});

void test('account BFF rejects extra fields, invalid providers, IDs, queries and bodies', async () => {
  const h = harness();
  for (const body of [
    { ...payment, provider: 'STRIPE' },
    { ...payment, secret: 'x' },
    { ...payment, accountIdentifier: '' },
    { ...payment, displayOrder: -1 },
    { ...payment, isActive: true },
  ])
    assert.equal((await h.accounts.POST(request(body), h.params)).status, 400);
  assert.equal(
    (await h.account.PATCH(request({ isActive: 'true' }), h.params)).status,
    400,
  );
  assert.equal(
    (await h.deactivate.POST(request({ unknown: true }), h.params)).status,
    400,
  );
  assert.equal(
    (
      await h.account.PATCH(request({ accountHolderName: 'x' }), {
        params: Promise.resolve({ destinationId, accountId: '../private' }),
      })
    ).status,
    404,
  );
  const badQuery = request(null);
  badQuery.nextUrl.searchParams.set('limit', '1000');
  assert.equal((await h.accounts.GET(badQuery, h.params)).status, 400);
  assert.equal(h.calls.length, 0);
});

void test('booking and account mutation bodies are bounded before forwarding', async () => {
  const h = harness();
  assert.equal(
    (
      await h.config.PUT(
        request({ ...draft, bookingInstructions: 'x'.repeat(9_000) }),
        h.params,
      )
    ).status,
    413,
  );
  assert.equal(
    (
      await h.accounts.POST(
        request({ ...payment, instructions: 'x'.repeat(9_000) }),
        h.params,
      )
    ).status,
    413,
  );
  assert.equal(
    (
      await h.deactivate.POST(
        {
          ...request(null),
          headers: new Headers({ 'content-length': '9000' }),
        },
        h.params,
      )
    ).status,
    413,
  );
  assert.equal(h.calls.length, 0);

  const streamed = new TextEncoder().encode(
    JSON.stringify({ ...draft, requestDescription: 'የጉዞ ጥያቄ መግለጫ' }),
  );
  const streamedRequest = {
    headers: new Headers(),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(streamed.subarray(0, 90));
        controller.enqueue(streamed.subarray(90));
        controller.close();
      },
    }),
  };
  assert.equal((await h.config.PUT(streamedRequest, h.params)).status, 200);
  assert.equal(h.calls.length, 1);

  const oversizedStream = {
    headers: new Headers(),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(8_193));
        controller.close();
      },
    }),
  };
  assert.equal((await h.config.PUT(oversizedStream, h.params)).status, 413);
  assert.equal(h.calls.length, 1);
});

void test('mutation origin and upstream auth/conflict statuses remain authoritative', async () => {
  const h = harness();
  h.originAllowed = false;
  assert.equal((await h.config.PUT(request(draft), h.params)).status, 403);
  h.originAllowed = true;
  for (const status of [401, 403, 404, 409]) {
    h.upstreamStatus = status;
    assert.equal(
      (await h.accounts.POST(request(payment), h.params)).status,
      status,
    );
  }
});

/** @param {unknown} node */
function flatten(node) {
  if (node === null || node === undefined || typeof node === 'boolean')
    return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node === 'string' || typeof node === 'number')
    return [String(node)];
  if (typeof node !== 'object') return [];
  return [node, ...flatten(node.props?.children)];
}

class MockAdminFetchError extends Error {
  constructor(status) {
    super('Request rejected');
    this.status = status;
  }
}

/** @param {'en'|'am'} locale @param {boolean} enabled @param {(path:string, init?:RequestInit)=>Promise<unknown>} [fetcher] @param {Array<{index:number,value:unknown}>} [updates] @param {{accountActive?:boolean,confirmAction?:{id:string,kind:'deactivate'|'reactivate'},confirmDisable?:boolean,errorKey?:string,noticeKey?:string}} [options] */
function render(
  locale,
  enabled,
  fetcher = () => Promise.resolve(null),
  updates = [],
  options = {},
) {
  const messages = JSON.parse(read(`messages/${locale}.json`)).adminPortal
    .destinationBookingConfig;
  const states = [
    {
      id: 'a',
      destinationId,
      bookingEnabled: enabled,
      priceAmount: '1500.00',
      currency: 'ETB',
      priceUnit: 'PER_BOOKING',
      requestDescription: 'A walking tour request',
      bookingInstructions: null,
      createdAt: null,
      updatedAt: null,
    },
    '1500.00',
    'A walking tour request',
    '',
    [
      {
        id: accountId,
        destinationId,
        provider: 'TELEBIRR',
        accountHolderName: 'Test Holder',
        accountIdentifier: '0912345678',
        instructions: null,
        isActive: options.accountActive ?? true,
        displayOrder: 0,
        createdAt: '',
        updatedAt: '',
      },
    ],
    1,
    1,
    1,
    {},
    null,
    false,
    options.confirmAction ?? null,
    false,
    false,
    options.errorKey ?? null,
    options.noticeKey ?? null,
    options.confirmDisable ?? false,
  ];
  let stateIndex = 0;
  const ui = execute(
    'app/admin/destinations/AdminDestinationBookingConfig.tsx',
    (name) => {
      if (name === 'react/jsx-runtime')
        return {
          jsx: (type, props) => ({ type, props }),
          jsxs: (type, props) => ({ type, props }),
        };
      if (name === 'react')
        return {
          useState: () => {
            const index = stateIndex++;
            return [states[index], (value) => updates.push({ index, value })];
          },
          useEffect: () => {},
          useCallback: (fn) => fn,
          useRef: (value) => ({ current: value }),
        };
      if (name === 'next-intl')
        return {
          useLocale: () => locale,
          useTranslations: () => (key) => messages[key] ?? key,
        };
      if (name.endsWith('/lib/admin'))
        return {
          adminFetch: fetcher,
          AdminFetchError: MockAdminFetchError,
        };
      throw new Error(`Unexpected import ${name}`);
    },
  );
  return flatten(
    ui.AdminDestinationBookingConfig({
      destinationId,
      destinationName: 'Lalibela',
      publicationStatus: 'DRAFT',
    }),
  );
}

void test('configuration submit sends false only once and reloads authoritative data', async () => {
  /** @type {Array<{path:string, init:RequestInit|undefined}>} */ const calls =
    [];
  const config = {
    bookingEnabled: false,
    priceAmount: '1500.00',
    requestDescription: 'A walking tour request',
    bookingInstructions: null,
  };
  const fetcher = (path, init) => {
    calls.push({ path, init });
    return Promise.resolve(
      path.endsWith('/booking-config')
        ? config
        : { data: [], meta: { page: 1, total: 0, totalPages: 0 } },
    );
  };
  const nodes = render('en', false, fetcher);
  const form = nodes.find(
    (node) =>
      node.type === 'form' && typeof node.props?.onSubmit === 'function',
  );
  assert.ok(form);
  const event = { preventDefault: () => {} };
  form.props.onSubmit(event);
  form.props.onSubmit(event);
  await nextTick();
  const puts = calls.filter((call) => call.init?.method === 'PUT');
  assert.equal(puts.length, 1);
  assert.equal(JSON.parse(puts[0].init.body).bookingEnabled, false);
  assert.equal(JSON.parse(puts[0].init.body).priceAmount, '1500.00');
  assert.equal(calls.filter((call) => !call.init).length, 2);
});

void test('an already-enabled configuration can be explicitly disabled but never re-enabled', async () => {
  for (const locale of ['en', 'am']) {
    const h = harness();
    const updates = [];
    let enabled = true;
    const fetcher = async (path, init) => {
      if (init?.method === 'PUT') {
        const response = await h.config.PUT(
          request(JSON.parse(init.body)),
          h.params,
        );
        assert.equal(response.status, 200);
        assert.equal(JSON.parse(init.body).bookingEnabled, false);
        assert.equal(JSON.parse(init.body).priceAmount, '1500.00');
        enabled = false;
        return response.body;
      }
      if (path.endsWith('/booking-config'))
        return {
          bookingEnabled: enabled,
          priceAmount: '1500.00',
          requestDescription: 'A walking tour request',
          bookingInstructions: null,
        };
      return { data: [], meta: { page: 1, total: 0, totalPages: 0 } };
    };
    const initial = render(locale, true, fetcher, updates);
    const disableTrigger = initial.find(
      (node) =>
        node.type === 'button' &&
        typeof node.props?.onClick === 'function' &&
        flatten(node).includes(
          JSON.parse(read(`messages/${locale}.json`)).adminPortal
            .destinationBookingConfig.disableBooking,
        ),
    );
    assert.ok(disableTrigger);
    disableTrigger.props.onClick();
    assert.ok(
      updates.some((entry) => entry.index === 16 && entry.value === true),
    );
    const confirmed = render(locale, true, fetcher, updates, {
      confirmDisable: true,
    });
    const dialog = confirmed.find((node) => node.props?.role === 'dialog');
    assert.ok(dialog);
    const primary = flatten(dialog).find(
      (node) =>
        node.type === 'button' && typeof node.props?.onClick === 'function',
    );
    primary.props.onClick();
    await nextTick();
    assert.equal(h.calls.length, 1);
    assert.ok(
      updates.some(
        (entry) => entry.index === 0 && entry.value?.bookingEnabled === false,
      ),
    );
    assert.ok(
      updates.some((entry) => entry.index === 16 && entry.value === false),
    );
  }
});

void test('network failure does not claim a saved configuration', async () => {
  /** @type {Array<{index:number,value:unknown}>} */ const updates = [];
  const nodes = render(
    'en',
    false,
    () => Promise.reject(new Error('offline')),
    updates,
  );
  const form = nodes.find(
    (node) =>
      node.type === 'form' && typeof node.props?.onSubmit === 'function',
  );
  assert.ok(form);
  form.props.onSubmit({ preventDefault: () => {} });
  await nextTick();
  assert.ok(
    updates.some(
      (entry) => entry.index === 14 && typeof entry.value === 'string',
    ),
  );
  assert.ok(
    !updates.some(
      (entry) => entry.index === 15 && typeof entry.value === 'string',
    ),
  );
});

void test('actual account status actions meet BFF contracts and refresh authoritative status', async () => {
  for (const kind of ['deactivate', 'reactivate']) {
    const h = harness();
    const updates = [];
    let active = kind === 'deactivate';
    const fetcher = async (path, init) => {
      if (init?.method) {
        const response =
          kind === 'deactivate'
            ? await h.deactivate.POST(
                { text: () => Promise.resolve(init.body ?? '') },
                h.params,
              )
            : await h.account.PATCH(request(JSON.parse(init.body)), h.params);
        assert.equal(response.status, 200);
        if (kind === 'deactivate') {
          assert.equal(init.method, 'POST');
          assert.equal(init.body, undefined);
          active = false;
        } else {
          assert.equal(init.method, 'PATCH');
          assert.deepEqual(JSON.parse(init.body), { isActive: true });
          active = true;
        }
        return response.body;
      }
      if (path.endsWith('/booking-config'))
        return {
          bookingEnabled: false,
          priceAmount: '1500.00',
          requestDescription: 'A walking tour request',
          bookingInstructions: null,
        };
      return {
        data: [{ id: accountId, isActive: active }],
        meta: { page: 1, total: 1, totalPages: 1 },
      };
    };
    const nodes = render('en', false, fetcher, updates, {
      accountActive: kind === 'deactivate',
      confirmAction: { id: accountId, kind },
    });
    const dialog = nodes.find((node) => node.props?.role === 'dialog');
    assert.ok(dialog);
    const primary = flatten(dialog).find(
      (node) =>
        node.type === 'button' && typeof node.props?.onClick === 'function',
    );
    assert.ok(primary);
    primary.props.onClick();
    await nextTick();
    assert.equal(h.calls.length, 1);
    assert.ok(
      updates.some(
        (entry) => entry.index === 4 && entry.value?.[0]?.isActive === active,
      ),
    );
    assert.ok(
      updates.some(
        (entry) => entry.index === 15 && typeof entry.value === 'string',
      ),
    );
  }
});

void test('stale account conflict refreshes server state without a false success', async () => {
  const updates = [];
  const reads = [];
  const fetcher = (path, init) => {
    if (init?.method) return Promise.reject(new MockAdminFetchError(409));
    reads.push(path);
    return Promise.resolve(
      path.endsWith('/booking-config')
        ? {
            bookingEnabled: false,
            priceAmount: null,
            requestDescription: null,
            bookingInstructions: null,
          }
        : {
            data: [{ id: accountId, isActive: false }],
            meta: { page: 1, total: 1, totalPages: 1 },
          },
    );
  };
  const nodes = render('en', false, fetcher, updates, {
    confirmAction: { id: accountId, kind: 'deactivate' },
  });
  const dialog = nodes.find((node) => node.props?.role === 'dialog');
  const primary = flatten(dialog).find(
    (node) =>
      node.type === 'button' && typeof node.props?.onClick === 'function',
  );
  primary.props.onClick();
  await nextTick();
  assert.equal(reads.length, 2);
  assert.ok(
    updates.some(
      (entry) => entry.index === 14 && typeof entry.value === 'string',
    ),
  );
  assert.ok(
    !updates.some(
      (entry) => entry.index === 15 && typeof entry.value === 'string',
    ),
  );
  assert.ok(
    updates.some(
      (entry) => entry.index === 4 && entry.value?.[0]?.isActive === false,
    ),
  );
});

void test('Escape closes account confirmation and restores action focus', () => {
  const updates = [];
  const nodes = render('en', false, undefined, updates, {
    confirmAction: { id: accountId, kind: 'deactivate' },
  });
  const trigger = nodes.find(
    (node) =>
      node.type === 'button' &&
      typeof node.props?.ref === 'function' &&
      flatten(node).includes('Deactivate account'),
  );
  assert.ok(trigger);
  let focused = 0;
  trigger.props.ref({ focus: () => focused++ });
  const dialog = nodes.find((node) => node.props?.role === 'dialog');
  let prevented = false;
  dialog.props.onKeyDown({
    key: 'Escape',
    preventDefault: () => {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(focused, 1);
  assert.ok(
    updates.some((entry) => entry.index === 11 && entry.value === null),
  );
});

void test('closed Admin navigation does not steal Escape focus from a confirmation dialog', () => {
  const shell = read('components/admin/AdminWorkspaceShell.tsx');
  assert.match(shell, /!drawerOpen \|\| event\.defaultPrevented/);
  assert.match(shell, /\}, \[drawerOpen\]\);/);
});

void test('persisted feedback keys render in the currently selected language', () => {
  for (const locale of ['en', 'am']) {
    const messages = JSON.parse(read(`messages/${locale}.json`)).adminPortal
      .destinationBookingConfig;
    const nodes = render(locale, false, undefined, [], {
      errorKey: 'invalidPrice',
      noticeKey: 'accountSaved',
    });
    assert.ok(nodes.includes(messages.invalidPrice));
    assert.ok(nodes.includes(messages.accountSaved));
  }
});

void test('Escape closes booking-disable confirmation and restores action focus', () => {
  const updates = [];
  const nodes = render('en', true, undefined, updates, {
    confirmDisable: true,
  });
  const trigger = nodes.find(
    (node) =>
      node.type === 'button' &&
      flatten(node).includes('Disable booking requests') &&
      node.props?.ref,
  );
  assert.ok(trigger);
  let focused = 0;
  trigger.props.ref.current = { focus: () => focused++ };
  const dialog = nodes.find((node) => node.props?.role === 'dialog');
  let prevented = false;
  dialog.props.onKeyDown({
    key: 'Escape',
    preventDefault: () => {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(focused, 1);
  assert.ok(
    updates.some((entry) => entry.index === 16 && entry.value === false),
  );
});

void test('English and Amharic UI render truthful disabled activation, masked accounts, and warning', () => {
  const en = JSON.parse(read('messages/en.json')).adminPortal
    .destinationBookingConfig;
  const am = JSON.parse(read('messages/am.json')).adminPortal
    .destinationBookingConfig;
  assert.deepEqual(Object.keys(en).sort(), Object.keys(am).sort());
  for (const locale of ['en', 'am']) {
    const nodes = render(locale, false);
    const text = nodes.filter((item) => typeof item === 'string').join(' ');
    assert.doesNotMatch(text, /0912345678/);
    assert.match(text, /5678/);
    assert.ok(
      nodes.some(
        (node) =>
          node.props?.id === 'destination-booking-enabled' &&
          node.props?.disabled === true &&
          node.props?.checked === false,
      ),
    );
    assert.ok(
      nodes.some(
        (node) =>
          node.props?.type === 'submit' && node.props?.disabled === false,
      ),
    );
    const enabledNodes = render(locale, true);
    const enabledText = enabledNodes
      .filter((item) => typeof item === 'string')
      .join(' ');
    assert.ok(
      enabledText.includes(
        locale === 'en' ? en.alreadyEnabledWarning : am.alreadyEnabledWarning,
      ),
    );
    assert.ok(
      enabledNodes.some(
        (node) =>
          node.props?.id === 'destination-booking-enabled' &&
          node.props?.disabled === true &&
          node.props?.checked === true,
      ),
    );
    assert.ok(
      enabledNodes.some(
        (node) =>
          node.props?.type === 'submit' && node.props?.disabled === true,
      ),
    );
  }
});

void test('UI source preserves policy gate, refresh-on-conflict, focus restoration, and existing editor integration', () => {
  const ui = read('app/admin/destinations/AdminDestinationBookingConfig.tsx');
  const editor = read('app/admin/destinations/AdminDestinationEditor.tsx');
  assert.match(ui, /bookingEnabled: false/);
  assert.doesNotMatch(ui, /bookingEnabled: true/);
  assert.match(ui, /cause\.status === 409/);
  assert.match(ui, /await load\(page, true\)/);
  assert.match(ui, /confirmButton\.current\?\.focus\(\)/);
  assert.match(ui, /statusTriggers\.current\.get\(id\)\?\.focus\(\)/);
  assert.match(ui, /event\.key === 'Escape'/);
  assert.match(ui, /if \(busyRef\.current\) return false/);
  assert.match(editor, /<AdminDestinationBookingConfig/);
  assert.doesNotMatch(ui, /console\.|localStorage|video|proof|paymentStatus/);
});
