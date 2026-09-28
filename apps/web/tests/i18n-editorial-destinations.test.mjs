import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {string} path @returns {Record<string, unknown>} */
function readCatalog(path) {
  /** @type {unknown} */
  const parsed = JSON.parse(read(path));
  if (!isRecord(parsed)) throw new Error(`Invalid message catalog: ${path}`);
  return parsed;
}

/** @param {Record<string, unknown>} catalog @param {string} name */
function namespace(catalog, name) {
  const value = catalog[name];
  if (!isRecord(value)) throw new Error(`Missing namespace: ${name}`);
  return value;
}

/** @param {Record<string, unknown>} catalog @param {string} key */
function message(catalog, key) {
  const value = catalog[key];
  if (typeof value !== 'string') throw new Error(`Missing message: ${key}`);
  return value;
}

/** @param {unknown} value @returns {string[]} */
function leafKeys(value, prefix = '') {
  if (typeof value === 'string') return [prefix];
  if (!isRecord(value)) return [];
  /** @type {string[]} */
  const keys = [];
  for (const [key, child] of Object.entries(value)) {
    keys.push(...leafKeys(child, prefix ? `${prefix}.${key}` : key));
  }
  return keys;
}

void test('destination editor catalog additions preserve English/Amharic parity', () => {
  const en = readCatalog('messages/en.json');
  const am = readCatalog('messages/am.json');
  const englishAdmin = namespace(en, 'adminPortal');
  const amharicAdmin = namespace(am, 'adminPortal');
  const keys = [
    'destinationContentLanguage',
    'destinationEnglishTab',
    'destinationAmharicTab',
    'destinationAmharicTranslation',
    'translationFallbackNotice',
    'translationPreview',
    'translationPublishRequirement',
  ];

  for (const key of keys) {
    assert.equal(typeof message(englishAdmin, key), 'string');
    assert.equal(typeof message(amharicAdmin, key), 'string');
  }
  assert.deepEqual(
    leafKeys(englishAdmin).sort(),
    leafKeys(amharicAdmin).sort(),
  );
  assert.match(
    message(amharicAdmin, 'destinationAmharicTranslation'),
    /[\u1200-\u137F]/,
  );
});

void test('destination editor keeps the canonical English form and adds an accessible Amharic draft lifecycle', () => {
  const editor = read('app/admin/destinations/AdminDestinationEditor.tsx');

  assert.match(editor, /role="tablist"/);
  assert.match(editor, /role="tab"/);
  assert.match(editor, /aria-selected=\{activeTab === tab\}/);
  assert.match(editor, /event\.key === 'ArrowRight'/);
  assert.match(editor, /event\.key === 'Escape'/);
  assert.match(editor, /maxLength=\{180\}/);
  assert.match(editor, /maxLength=\{300\}/);
  assert.match(editor, /maxLength=\{20000\}/);
  assert.match(editor, /maxLength=\{1000\}/);
  assert.match(editor, /translationIsComplete\(translationForm\)/);
  assert.match(editor, /saveTranslationDraft\(\)/);
  assert.match(editor, /translations\/am\/\$\{action\}/);
  assert.match(editor, /translationFallbackNotice/);
  assert.match(editor, /translationPreviewFallback/);
  assert.match(editor, /item\?\.name/);
  assert.doesNotMatch(editor, /\/api\/v1\/destinations/);
  assert.doesNotMatch(
    editor,
    /localStorage|sessionStorage|accessToken|refreshToken/,
  );
});

void test('fixed translation BFF routes preserve admin session forwarding, same-origin mutations, and strict body allowlists', () => {
  const rootRoute = read(
    'app/api/admin/destinations/[destinationId]/translations/am/route.ts',
  );
  const publish = read(
    'app/api/admin/destinations/[destinationId]/translations/am/publish/route.ts',
  );
  const unpublish = read(
    'app/api/admin/destinations/[destinationId]/translations/am/unpublish/route.ts',
  );
  const helper = read('app/api/admin/bff.ts');

  assert.match(rootRoute, /translations\/am/);
  assert.match(rootRoute, /adminAllowedBody\(request, fields, true\)/);
  assert.match(rootRoute, /adminUuid\(destinationId, 'Destination'\)/);
  assert.match(publish, /translations\/am\/publish/);
  assert.match(unpublish, /translations\/am\/unpublish/);
  assert.match(helper, /validateSameOrigin/);
  for (const source of [rootRoute, publish, unpublish, helper]) {
    assert.doesNotMatch(
      source,
      /localStorage|sessionStorage|accessToken|refreshToken|console\.log/,
    );
  }
});

void test('F2 does not alter public destination or shared-trip routing', () => {
  const editor = read('app/admin/destinations/AdminDestinationEditor.tsx');
  const sharedTrip = read('components/trips/SharedTripClient.tsx');

  assert.doesNotMatch(editor, /\/shared-trip/);
  assert.match(sharedTrip, /history\.replaceState/);
  assert.match(sharedTrip, /\/api\/trip-shares\/resolve/);
});
