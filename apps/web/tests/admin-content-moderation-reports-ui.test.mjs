import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('Admin Portal navigation exposes implemented content, moderation, and operations routes', () => {
  const shell = read('components/admin/AdminWorkspaceShell.tsx');
  for (const label of ['Destinations', 'Categories', 'Moderation', 'Reports']) {
    assert.match(shell, new RegExp(`label: '${label}'`));
  }
  assert.match(shell, /label: 'Bookings'/);
  assert.match(shell, /label: 'Payments'/);
  assert.match(shell, /label: 'Analytics'/);
  assert.match(shell, /label: 'Settings'/);
  assert.match(shell, /aria-current=\{active \? 'page' : undefined\}/);
  assert.match(shell, /event\.key !== 'Escape'/);
});

void test('destination CMS keeps editing separate from publication and supports bounded list filtering', () => {
  const list = read('app/admin/destinations/AdminDestinationsClient.tsx');
  const editor = read('app/admin/destinations/AdminDestinationEditor.tsx');
  const destinationsBff = read('app/api/admin/destinations/route.ts');
  const publishBff = read(
    'app/api/admin/destinations/[destinationId]/publish/route.ts',
  );

  assert.match(list, /placeholder="Name or description"/);
  assert.match(list, /Apply filters/);
  assert.match(list, /Destination pagination/);
  assert.match(editor, /Save draft/);
  assert.match(editor, /Confirm publication\s+separately/);
  assert.match(
    editor,
    /router\.replace\(`\/admin\/destinations\/\$\{result\.id\}`\)/,
  );
  assert.match(destinationsBff, /adminJson/);
  assert.match(destinationsBff, /adminAllowedBody/);
  assert.match(publishBff, /adminJson/);
});

void test('category domains stay distinct and use the secured category BFF', () => {
  const categories = read('app/admin/categories/AdminCategoriesClient.tsx');
  const businessBff = read('app/api/admin/categories/business/route.ts');
  const serviceBff = read('app/api/admin/categories/service/route.ts');

  assert.match(categories, /Business Categories/);
  assert.match(categories, /Service Categories/);
  assert.match(categories, /Service family/);
  assert.doesNotMatch(categories, /Delete category/);
  assert.match(businessBff, /adminAllowedBody/);
  assert.match(serviceBff, /adminAllowedBody/);
  assert.match(serviceBff, /'family'/);
});

void test('moderation and reports use explicit reasoned actions with no browser token storage', () => {
  const moderation = read('app/admin/moderation/AdminModerationClient.tsx');
  const reviewDetail = read(
    'app/admin/moderation/reviews/[reviewId]/AdminReviewDetailClient.tsx',
  );
  const reports = read('app/admin/reports/AdminReportsClient.tsx');
  const reportDetail = read(
    'app/admin/reports/[reportId]/AdminReportDetailClient.tsx',
  );
  const dialog = read('components/admin/AdminNoteActionDialog.tsx');
  const bff = read('app/api/admin/bff.ts');
  const reportBff = read('app/api/reports/route.ts');

  assert.match(moderation, /\/api\/admin\/moderation/);
  assert.match(reviewDetail, /\/hide/);
  assert.match(reviewDetail, /\/restore/);
  assert.match(reports, /\/api\/admin\/reports/);
  assert.match(reportDetail, /\/start-review/);
  assert.match(reportDetail, /\/resolve/);
  assert.match(reportDetail, /\/dismiss/);
  assert.match(dialog, /minLength=\{3\}/);
  assert.match(dialog, /event\.key === 'Escape'/);
  assert.match(bff, /validateSameOrigin/);
  assert.match(reportBff, /validateSameOrigin/);
  for (const source of [bff, reportBff, dialog, reports, reportDetail]) {
    assert.doesNotMatch(
      source,
      /localStorage|sessionStorage|accessToken|refreshToken/,
    );
  }
});
