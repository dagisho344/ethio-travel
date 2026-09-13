import { ConflictException, NotFoundException } from '@nestjs/common';
import { BusinessMemberRole, VerificationRequestStatus } from '@prisma/client';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BusinessVerificationsService } from './business-verifications/business-verifications.service';
import { BusinessesService } from './businesses/businesses.service';
import { envValidationSchema } from './config/env.validation';
import { PrismaService } from './prisma/prisma.service';
import { DevelopmentStorageProvider } from './storage/development-storage.provider';

const businessId = '22222222-2222-4222-8222-222222222222';
const documentId = '33333333-3333-4333-8333-333333333333';
const userId = '11111111-1111-4111-8111-111111111111';

describe('Phase 12C media and verification safeguards', () => {
  let storageRoot = '';
  let previousRoot: string | undefined;

  beforeEach(async () => {
    previousRoot = process.env.STORAGE_DEVELOPMENT_ROOT;
    storageRoot = await mkdtemp(join(tmpdir(), 'ethio-media-'));
    process.env.STORAGE_DEVELOPMENT_ROOT = storageRoot;
  });

  afterEach(async () => {
    if (previousRoot === undefined) delete process.env.STORAGE_DEVELOPMENT_ROOT;
    else process.env.STORAGE_DEVELOPMENT_ROOT = previousRoot;
    await rm(storageRoot, { force: true, recursive: true });
  });

  it('stores generated public and private namespace objects without exposing filesystem paths', async () => {
    const provider = new DevelopmentStorageProvider();
    const publicKey = `public/businesses/${businessId}/${documentId}.png`;
    const privateKey = `private/verifications/${businessId}/${documentId}.pdf`;

    await provider.putObject({
      body: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      key: publicKey,
      mimeType: 'image/png',
      sizeBytes: 4,
    });
    await provider.putObject({
      body: Buffer.from('%PDF-1.7'),
      key: privateKey,
      mimeType: 'application/pdf',
      sizeBytes: 8,
    });

    await expect(provider.readObject(publicKey)).resolves.toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );
    await expect(provider.readObject(privateKey)).resolves.toEqual(
      Buffer.from('%PDF-1.7'),
    );
    expect(provider.publicUrl(publicKey)).toBeNull();
    await expect(
      provider.signedPrivateReadUrl(privateKey, 300),
    ).resolves.toBeNull();
  });

  it('rejects traversal and arbitrary storage namespaces', async () => {
    const provider = new DevelopmentStorageProvider();

    await expect(
      provider.putObject({
        body: Buffer.from('unsafe'),
        key: '../../private/verifications/escape.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 6,
      }),
    ).rejects.toThrow('Storage key is outside an allowed namespace.');
    expect(() => provider.readObject('public/other/object.png')).toThrow(
      'Storage key is outside an allowed namespace.',
    );
  });

  it('requires full server-only S3 configuration when S3 storage is selected', () => {
    const result = envValidationSchema.validate({
      DATABASE_URL: 'postgresql://user:password@localhost:5432/ethio',
      JWT_ACCESS_SECRET: '01234567890123456789012345678901',
      REDIS_URL: 'redis://localhost:6379',
      STORAGE_PROVIDER: 'S3',
    });

    expect(result.error).toBeDefined();
    expect(result.error?.message).toMatch(/S3_(ACCESS_KEY_ID|ENDPOINT)/);
  });

  it('keeps the Phase 12C migration additive and preserves existing records', async () => {
    const sql = await readFile(
      join(
        process.cwd(),
        'prisma/migrations/20260912000001_media_verification_lifecycle/migration.sql',
      ),
      'utf8',
    );

    expect(sql).toContain("ADD VALUE IF NOT EXISTS 'DRAFT'");
    expect(sql).toContain('business_verifications_one_draft_per_business');
    expect(sql).toContain("DEFAULT 'READY'");
    expect(sql).not.toMatch(/\bDROP\s+TABLE\b|\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/^\s*UPDATE\s+/im);
  });

  it('blocks the compatibility submit path when no complete draft exists', async () => {
    const prisma = {
      businessVerification: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const businesses = {
      requireMembership: jest.fn().mockResolvedValue({
        role: BusinessMemberRole.OWNER,
      }),
    } as unknown as BusinessesService;
    const service = new BusinessVerificationsService(prisma, businesses);

    await expect(service.submit(userId, businessId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('does not return an editable draft through the administrator detail query', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = {
      businessVerification: { findFirst },
    } as unknown as PrismaService;
    const businesses = {} as BusinessesService;
    const service = new BusinessVerificationsService(prisma, businesses);

    await expect(service.findAdminById(documentId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: documentId,
          status: { not: VerificationRequestStatus.DRAFT },
        },
      }),
    );
  });
});
