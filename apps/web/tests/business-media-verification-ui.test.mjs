import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('media and verification BFF routes use HttpOnly server sessions and preserve multipart bodies', () => {
  for (const path of [
    'app/api/businesses/manage/[businessId]/media/bff.ts',
    'app/api/businesses/manage/[businessId]/verification/bff.ts',
  ]) {
    const source = read(path);
    assert.match(source, /authenticatedBackendResponse/);
    assert.match(source, /validateSameOrigin\(request\)/);
    assert.match(source, /request\.formData\(\)/);
    assert.match(source, /new FormData\(\)/);
    assert.doesNotMatch(
      source,
      /localStorage|sessionStorage|accessToken|refreshToken/,
    );
  }
});

void test('business media and verification UI reflect server-authorized roles and safe upload limits', () => {
  const media = read('components/businesses/BusinessMediaClient.tsx');
  const verification = read(
    'components/businesses/BusinessVerificationClient.tsx',
  );

  assert.match(media, /canEditBusiness/);
  assert.match(media, /useTranslations\('businessPortal'\)/);
  assert.match(media, /t\('staffMediaReadOnly'\)/);
  assert.match(media, /10 \* 1024 \* 1024/);
  assert.match(media, /image\/jpeg.*image\/png.*image\/webp/);
  assert.match(media, /t\('moveUp'\)/);
  assert.match(media, /t\('moveDown'\)/);
  assert.doesNotMatch(
    media,
    /localStorage|sessionStorage|accessToken|refreshToken/,
  );

  assert.match(verification, /canEditBusiness/);
  assert.match(verification, /useTranslations\('businessPortal'\)/);
  assert.match(verification, /t\('staffVerificationReadOnly'\)/);
  assert.match(verification, /15 \* 1024 \* 1024/);
  assert.match(verification, /application\/pdf.*image\/jpeg.*image\/png/);
  assert.match(verification, /t\('submitVerification'\)/);
  assert.match(verification, /t\('correctResubmit'\)/);
  assert.doesNotMatch(
    verification,
    /localStorage|sessionStorage|accessToken|refreshToken/,
  );
});

void test('admin document forwarding only relays safe response headers', () => {
  const source = read('app/api/admin/verifications/bff.ts');
  assert.match(source, /authenticatedBackendResponse/);
  assert.match(source, /content-disposition/);
  assert.match(source, /content-type/);
  assert.match(source, /validateSameOrigin\(request\)/);
  assert.doesNotMatch(source, /S3_SECRET_ACCESS_KEY|S3_ACCESS_KEY_ID/);
});
