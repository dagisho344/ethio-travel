/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-base-to-string -- VM-loaded TSX/route exports and synthetic JSX nodes are checked at runtime. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import vm from 'node:vm';
import ts from 'typescript';

const root = join(import.meta.dirname, '..');
const destinationId = '11111111-1111-4111-8111-111111111111';
const mediaId = '22222222-2222-4222-8222-222222222222';
const read = (path) => readFileSync(join(root, path), 'utf8');

/** @param {string} path @param {(name:string)=>unknown} imports @param {Record<string,unknown>} [globals] */
function execute(path, imports, globals = {}) {
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
    File,
    FormData,
    Headers,
    Set,
    Number,
    JSON,
    ...globals,
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
  /** @param {unknown} body @param {{headers?:Headers,status?:number}} [init] */
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status ?? 200;
    this.headers = init.headers ?? new Headers();
  }
  /** @param {unknown} data @param {{status?:number}} [init] */
  static json(data, init = {}) {
    return new MockResponse(data, init);
  }
}

function harness() {
  /** @type {Array<{path:string,init:RequestInit}>} */ const calls = [];
  let cleared = 0;
  let originAllowed = true;
  let backendStatus = 0;
  const session = {
    BffAuthError,
    authenticatedBackendResponse: (path, init) => {
      calls.push({ path, init });
      if (backendStatus)
        throw new BffAuthError(backendStatus, 'Backend denied');
      return {
        response: {
          json: () => Promise.resolve({ mediaId }),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(2)),
          headers: new Headers({
            'content-type': 'image/png',
            'x-content-type-options': 'nosniff',
          }),
        },
      };
    },
    clearAuthCookies: () => {
      cleared++;
    },
    jsonError: (error) =>
      new MockResponse(
        { message: error.message },
        { status: error.status ?? 500 },
      ),
    setAuthCookies: () => {},
    validateSameOrigin: () => {
      if (!originAllowed) throw new BffAuthError(403, 'Origin denied');
    },
  };
  const admin = {
    adminUuid: (id) => {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id,
        )
      )
        throw new BffAuthError(404, 'Not found');
      return id;
    },
    adminError: (error) => session.jsonError(error),
    adminJson: (_request, path, init = {}) => {
      calls.push({ path, init });
      return new MockResponse({ ok: true });
    },
    safeAdminQuery: () => '?page=1&limit=100',
  };
  const helper = execute(
    'app/api/admin/destinations/[destinationId]/media/bff.ts',
    (name) => {
      if (name === 'next/server') return { NextResponse: MockResponse };
      if (name.endsWith('/lib/auth/session')) return session;
      if (name === '../../../bff') return admin;
      throw new Error(`Unexpected import ${name}`);
    },
  );
  const route = execute(
    'app/api/admin/destinations/[destinationId]/media/route.ts',
    (name) => (name === '../../../bff' ? admin : helper),
  );
  const metadata = execute(
    'app/api/admin/destinations/[destinationId]/media/[mediaId]/route.ts',
    (name) => (name === '../../../../bff' ? admin : helper),
  );
  const archive = execute(
    'app/api/admin/destinations/[destinationId]/media/[mediaId]/archive/route.ts',
    (name) => (name === '../../../../../bff' ? admin : helper),
  );
  const reorder = execute(
    'app/api/admin/destinations/[destinationId]/media/reorder/route.ts',
    (name) => (name === '../../../../bff' ? admin : helper),
  );
  const content = execute(
    'app/api/admin/destinations/[destinationId]/media/[mediaId]/content/route.ts',
    (name) => (name === '../../../../../bff' ? admin : helper),
  );
  const params = { params: Promise.resolve({ destinationId, mediaId }) };
  return {
    helper,
    route,
    metadata,
    archive,
    reorder,
    content,
    params,
    calls,
    get cleared() {
      return cleared;
    },
    set originAllowed(value) {
      originAllowed = value;
    },
    set backendStatus(value) {
      backendStatus = value;
    },
  };
}

/** @param {unknown} body */
function jsonRequest(body) {
  return { json: () => Promise.resolve(body), text: () => Promise.resolve('') };
}

/** @param {FormData} data */
function uploadRequest(data) {
  return { formData: () => Promise.resolve(data), headers: new Headers() };
}

void test('Admin media list and preview use validated scoped paths', async () => {
  const h = harness();
  const listed = await h.route.GET(jsonRequest(null), h.params);
  assert.equal(listed.status, 200);
  assert.equal(
    h.calls[0].path,
    `/admin/destinations/${destinationId}/media?page=1&limit=100`,
  );
  const preview = await h.content.GET(jsonRequest(null), h.params);
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get('cache-control'), 'no-store');
  assert.equal(preview.headers.get('content-type'), 'image/png');
  assert.equal(
    h.calls[1].path,
    `/admin/destinations/${destinationId}/media/${mediaId}/content`,
  );
  const invalid = await h.content.GET(jsonRequest(null), {
    params: Promise.resolve({ destinationId, mediaId: '../private' }),
  });
  assert.equal(invalid.status, 404);
  const invalidDestination = await h.route.GET(jsonRequest(null), {
    params: Promise.resolve({ destinationId: '../private' }),
  });
  assert.equal(invalidDestination.status, 404);
  const emptyMediaId = await h.content.GET(jsonRequest(null), {
    params: Promise.resolve({ destinationId, mediaId: '' }),
  });
  assert.equal(emptyMediaId.status, 404);
  assert.equal(h.calls.length, 2);
});

void test('Upload accepts image roles and rejects unsafe multipart fields, media, and origin', async () => {
  const h = harness();
  const valid = new FormData();
  valid.set('role', 'HERO');
  valid.set('file', new File(['small image'], 'a.png', { type: 'image/png' }));
  valid.set('altText', 'Landscape');
  assert.equal(
    (await h.route.POST(uploadRequest(valid), h.params)).status,
    201,
  );
  assert.equal(
    h.calls[0].path,
    `/admin/destinations/${destinationId}/media/uploads`,
  );
  assert.equal(h.calls[0].init.body.get('role'), 'HERO');
  assert.equal(h.calls[0].init.body.get('altText'), 'Landscape');
  for (const [field, value] of [
    ['role', 'LOGO'],
    ['unsupported', 'x'],
  ]) {
    const data = new FormData();
    for (const [name, entry] of valid) data.set(name, entry);
    data.set(field, value);
    assert.equal(
      (await h.route.POST(uploadRequest(data), h.params)).status,
      400,
      `field ${field} should be rejected`,
    );
  }
  const video = new FormData();
  video.set('role', 'GALLERY');
  video.set('file', new File(['video'], 'a.mp4', { type: 'video/mp4' }));
  assert.equal(
    (await h.route.POST(uploadRequest(video), h.params)).status,
    400,
  );
  const large = new FormData();
  large.set('role', 'GALLERY');
  large.set(
    'file',
    new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'a.png', {
      type: 'image/png',
    }),
  );
  assert.equal(
    (await h.route.POST(uploadRequest(large), h.params)).status,
    400,
  );
  h.originAllowed = false;
  assert.equal(
    (await h.route.POST(uploadRequest(valid), h.params)).status,
    403,
  );
});

void test('Metadata, archive, and reorder reject unknown fields and invalid IDs', async () => {
  const h = harness();
  assert.equal(
    (await h.metadata.PATCH(jsonRequest({ altText: 'View' }), h.params)).status,
    200,
  );
  assert.equal(h.calls[0].init.body, JSON.stringify({ altText: 'View' }));
  assert.equal(
    (await h.metadata.PATCH(jsonRequest({ storageKey: 'private/x' }), h.params))
      .status,
    400,
  );
  assert.equal(
    (
      await h.metadata.PATCH(
        jsonRequest({ caption: 'x'.repeat(501) }),
        h.params,
      )
    ).status,
    400,
  );
  assert.equal(
    (await h.reorder.POST(jsonRequest({ mediaIds: [mediaId] }), h.params))
      .status,
    200,
  );
  assert.equal(
    (
      await h.reorder.POST(
        jsonRequest({ mediaIds: [mediaId, mediaId] }),
        h.params,
      )
    ).status,
    400,
  );
  assert.equal(
    (await h.reorder.POST(jsonRequest({ mediaIds: ['../x'] }), h.params))
      .status,
    400,
  );
  assert.equal((await h.archive.POST(jsonRequest(null), h.params)).status, 200);
  assert.equal(
    (
      await h.archive.POST(
        { text: () => Promise.resolve('unexpected') },
        h.params,
      )
    ).status,
    400,
  );
  h.originAllowed = false;
  assert.equal(
    (await h.metadata.PATCH(jsonRequest({ caption: 'x' }), h.params)).status,
    403,
  );
});

void test('Upload and preview propagate auth and backend failures safely', async () => {
  const h = harness();
  h.backendStatus = 401;
  assert.equal((await h.content.GET(jsonRequest(null), h.params)).status, 401);
  assert.equal(h.cleared, 1);
  const data = new FormData();
  data.set('role', 'GALLERY');
  data.set('file', new File(['image'], 'a.png', { type: 'image/png' }));
  assert.equal((await h.route.POST(uploadRequest(data), h.params)).status, 401);
  assert.equal(h.cleared, 2);
  h.backendStatus = 409;
  assert.equal((await h.route.POST(uploadRequest(data), h.params)).status, 409);
});

void test('Admin image UI and English/Amharic messages cover HERO, gallery, archive and deferrals', () => {
  const ui = read('app/admin/destinations/AdminDestinationMedia.tsx');
  const editor = read('app/admin/destinations/AdminDestinationEditor.tsx');
  const en = JSON.parse(read('messages/en.json')).adminPortal.destinationMedia;
  const am = JSON.parse(read('messages/am.json')).adminPortal.destinationMedia;
  assert.deepEqual(Object.keys(en).sort(), Object.keys(am).sort());
  for (const value of Object.values(am)) assert.ok(value.length > 0);
  for (const key of [
    'hero',
    'gallery',
    'noHero',
    'noGallery',
    'replaceHero',
    'setHero',
    'archive',
    'reordered',
    'videoDeferred',
    'paymentDeferred',
  ]) {
    assert.match(ui, new RegExp(`t\\('${key}'\\)`));
  }
  assert.match(editor, /<AdminDestinationMedia/);
  assert.match(ui, /await loadPage\(1\)/);
  assert.match(ui, /new FormData\(form\)/);
  assert.match(ui, /image\/jpeg,image\/png,image\/webp/);
  assert.match(ui, /credentials: 'same-origin'/);
  assert.doesNotMatch(ui, /video\/|type="video"|Telebirr|CBE/);
});

/** @param {Array<Record<string,unknown>>} items @param {'en'|'am'} locale @param {boolean} [archived] @param {string|null} [confirmArchive] */
function renderMedia(items, locale, archived = false, confirmArchive = null) {
  const messages = JSON.parse(read(`messages/${locale}.json`)).adminPortal
    .destinationMedia;
  const initial = [
    items,
    null,
    false,
    false,
    null,
    null,
    'GALLERY',
    null,
    confirmArchive,
  ];
  let stateIndex = 0;
  const component = execute(
    'app/admin/destinations/AdminDestinationMedia.tsx',
    (name) => {
      if (name === 'react/jsx-runtime') {
        return {
          jsx: (type, props) => ({ type, props }),
          jsxs: (type, props) => ({ type, props }),
        };
      }
      if (name === 'react') {
        return {
          useState: () => [initial[stateIndex++], () => {}],
          useEffect: () => {},
          useCallback: (callback) => callback,
          useRef: (value) => ({ current: value }),
        };
      }
      if (name === 'next/image') return { default: 'Image' };
      if (name === 'next-intl') {
        return {
          useTranslations: () => (key, values) =>
            String(messages[key] ?? key).replace('{name}', values?.name ?? ''),
        };
      }
      if (name.endsWith('/lib/admin'))
        return { adminFetch: () => Promise.resolve(null) };
      throw new Error(`Unexpected import ${name}`);
    },
  );
  return component.AdminDestinationMedia({
    destinationId,
    destinationName: 'Lalibela',
    archived,
  });
}

/** @param {unknown} node */
function flatten(node) {
  if (node === null || node === undefined || typeof node === 'boolean')
    return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node !== 'object') return [String(node)];
  return [node, ...flatten(node.props?.children)];
}

void test('Rendered Admin media states show empty, HERO, gallery, archive controls in both locales', () => {
  const en = JSON.parse(read('messages/en.json')).adminPortal.destinationMedia;
  const am = JSON.parse(read('messages/am.json')).adminPortal.destinationMedia;
  for (const [locale, messages] of [
    ['en', en],
    ['am', am],
  ]) {
    const empty = flatten(renderMedia([], locale));
    assert.ok(empty.includes(messages.noHero));
    assert.ok(empty.includes(messages.noGallery));
    assert.ok(empty.includes(messages.videoDeferred));
    assert.ok(empty.includes(messages.paymentDeferred));
    const rows = [
      {
        mediaId,
        role: 'HERO',
        status: 'READY',
        sortOrder: 0,
        altText: 'Hero',
        caption: null,
      },
      {
        mediaId: destinationId,
        role: 'GALLERY',
        status: 'READY',
        sortOrder: 0,
        altText: 'Gallery',
        caption: null,
      },
      {
        mediaId: '33333333-3333-4333-8333-333333333333',
        role: 'HERO',
        status: 'ARCHIVED',
        sortOrder: 0,
        altText: null,
        caption: null,
      },
    ];
    const rendered = flatten(renderMedia(rows, locale));
    assert.ok(rendered.includes(messages.hero));
    assert.ok(rendered.includes(messages.gallery));
    assert.ok(rendered.includes(messages.history));
    assert.ok(rendered.includes(messages.archive));
    assert.ok(rendered.includes(messages.statusARCHIVED));
    assert.equal(rendered.filter((node) => node.type === 'Image').length, 3);
    assert.ok(
      rendered.some(
        (node) =>
          node.type === 'Image' &&
          node.props.src ===
            `/api/admin/destinations/${destinationId}/media/${mediaId}/content`,
      ),
    );
    const archived = flatten(renderMedia(rows, locale, true));
    assert.ok(archived.includes(messages.archivedDestination));
    assert.ok(!archived.includes(messages.uploadTitle));
    assert.ok(!archived.includes(messages.archive));
  }
});

void test('Archive cancel and Escape restore focus to the action that opened confirmation', () => {
  const messages = JSON.parse(read('messages/en.json')).adminPortal
    .destinationMedia;
  const media = {
    mediaId,
    role: 'GALLERY',
    status: 'READY',
    sortOrder: 0,
    altText: null,
    caption: null,
  };
  for (const dismiss of ['cancel', 'escape']) {
    const nodes = flatten(renderMedia([media], 'en', false, mediaId));
    const archiveButton = nodes.find(
      (node) =>
        node.type === 'button' && node.props.children === messages.archive,
    );
    const group = nodes.find((node) => node.props?.role === 'group');
    assert.ok(archiveButton);
    assert.ok(group);
    let focusCount = 0;
    archiveButton.props.ref({ focus: () => focusCount++ });
    if (dismiss === 'cancel') {
      const cancel = flatten(group).find(
        (node) =>
          node.type === 'button' && node.props.children === messages.cancel,
      );
      assert.ok(cancel);
      cancel.props.onClick();
    } else {
      let prevented = false;
      let stopped = false;
      group.props.onKeyDown({
        key: 'Escape',
        preventDefault: () => {
          prevented = true;
        },
        stopPropagation: () => {
          stopped = true;
        },
      });
      assert.equal(prevented, true);
      assert.equal(stopped, true);
    }
    assert.equal(focusCount, 1);
  }
});

void test('Upload validates files, posts image multipart, resets the form, and reloads server state', async () => {
  const calls = [];
  const file = new File(['valid'], 'view.png', { type: 'image/png' });
  const initial = [[], null, false, false, null, null, 'HERO', file, null];
  let stateIndex = 0;
  let reset = 0;
  class FakeFormData {
    constructor() {
      this.values = new Map();
    }
    set(key, value) {
      this.values.set(key, value);
    }
    get(key) {
      return this.values.get(key);
    }
  }
  const component = execute(
    'app/admin/destinations/AdminDestinationMedia.tsx',
    (name) => {
      if (name === 'react/jsx-runtime')
        return {
          jsx: (type, props) => ({ type, props }),
          jsxs: (type, props) => ({ type, props }),
        };
      if (name === 'react')
        return {
          useState: () => [initial[stateIndex++], () => {}],
          useEffect: () => {},
          useCallback: (callback) => callback,
          useRef: (value) => ({ current: value }),
        };
      if (name === 'next/image') return { default: 'Image' };
      if (name === 'next-intl') return { useTranslations: () => (key) => key };
      if (name.endsWith('/lib/admin'))
        return {
          adminFetch: (path) => {
            calls.push({ kind: 'list', path });
            return Promise.resolve({ data: [], meta: { totalPages: 0 } });
          },
        };
      throw new Error(`Unexpected import ${name}`);
    },
    {
      FormData: FakeFormData,
      fetch: (path, init) => {
        calls.push({ kind: 'upload', path, init });
        return Promise.resolve({ ok: true, status: 201 });
      },
    },
  );
  const tree = component.AdminDestinationMedia({
    destinationId,
    destinationName: 'Lalibela',
    archived: false,
  });
  const submit = flatten(tree).find(
    (node) => node.type === 'form' && flatten(node).includes('uploadTitle'),
  );
  assert.ok(submit);
  submit.props.onSubmit({
    preventDefault: () => {},
    currentTarget: {
      reset: () => {
        reset++;
      },
    },
  });
  await setImmediate();
  assert.equal(calls[0].kind, 'upload');
  assert.equal(calls[0].init.body.get('role'), 'HERO');
  assert.equal(calls[0].init.body.get('file'), file);
  assert.equal(calls[1].kind, 'list');
  assert.equal(
    calls[1].path,
    `/api/admin/destinations/${destinationId}/media?page=1&limit=100`,
  );
  assert.equal(reset, 1);
});
