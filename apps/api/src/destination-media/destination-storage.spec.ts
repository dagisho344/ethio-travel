import { PutObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { AppConfig } from '../config/app.config';
import { DevelopmentStorageProvider } from '../storage/development-storage.provider';
import { S3StorageProvider } from '../storage/s3-storage.provider';

const destinationId = '11111111-1111-4111-8111-111111111111';
const mediaId = '22222222-2222-4222-8222-222222222222';
const key = `private/destinations/${destinationId}/${mediaId}.png`;
const legacyPublicKey = `public/destinations/${destinationId}/${mediaId}.png`;

describe('Destination storage provider compatibility', () => {
  let storageRoot = '';
  let previousRoot: string | undefined;

  beforeEach(async () => {
    previousRoot = process.env.STORAGE_DEVELOPMENT_ROOT;
    storageRoot = await mkdtemp(join(tmpdir(), 'ethio-destination-media-'));
    process.env.STORAGE_DEVELOPMENT_ROOT = storageRoot;
  });

  afterEach(async () => {
    if (previousRoot === undefined) delete process.env.STORAGE_DEVELOPMENT_ROOT;
    else process.env.STORAGE_DEVELOPMENT_ROOT = previousRoot;

    const safeRoot = resolve(tmpdir());
    if (
      !resolve(storageRoot).startsWith(`${safeRoot}${sep}`) ||
      !storageRoot.startsWith(join(safeRoot, 'ethio-destination-media-'))
    ) {
      throw new Error('Refusing to remove an unexpected storage test path.');
    }
    await rm(storageRoot, { recursive: true, force: true });
  });

  it('stores and removes a destination image in the local provider without publishing a filesystem URL', async () => {
    const provider = new DevelopmentStorageProvider();
    const body = Buffer.from('destination image');
    await expect(
      provider.putObject({
        key,
        body,
        mimeType: 'image/png',
        sizeBytes: body.length,
      }),
    ).resolves.toMatchObject({ key, sizeBytes: body.length });
    await expect(provider.readObject(key)).resolves.toEqual(body);
    expect(provider.publicUrl(key)).toBeNull();
    await provider.deleteObject(key);
    await expect(provider.getObjectMetadata(key)).resolves.toBeNull();
  });

  it('rejects arbitrary or traversing keys in the local provider', async () => {
    const provider = new DevelopmentStorageProvider();
    expect(() => provider.readObject('../private/secret')).toThrow(
      'Storage key is outside an allowed namespace.',
    );
    await expect(
      provider.putObject({
        key: `private/destinations/${destinationId}/../${mediaId}.png`,
        body: Buffer.from('unsafe'),
        mimeType: 'image/png',
        sizeBytes: 6,
      }),
    ).rejects.toThrow('Storage key is outside an allowed namespace.');
  });

  it('writes destination images to the S3 private bucket without exposing a direct public URL', async () => {
    const config = {
      get: (name: keyof AppConfig) => {
        const values = {
          s3AccessKeyId: 'test-access',
          s3SecretAccessKey: 'test-secret',
          s3Endpoint: 'http://127.0.0.1:9000',
          s3ForcePathStyle: true,
          s3Region: 'us-east-1',
          s3PublicBaseUrl: 'https://media.example.test/',
          s3BucketPublic: 'public-bucket',
          s3BucketPrivate: 'private-bucket',
        };
        return values[name as keyof typeof values];
      },
    } as unknown as ConfigService<AppConfig, true>;
    const provider = new S3StorageProvider(config);
    const send = jest.fn().mockResolvedValue({});
    Reflect.set(provider, 'client', { send });
    const body = Buffer.from('destination image');
    await provider.putObject({
      key,
      body,
      mimeType: 'image/png',
      sizeBytes: body.length,
    });
    const calls = send.mock.calls as unknown as [PutObjectCommand][];
    expect(calls[0]?.[0].input).toMatchObject({
      Bucket: 'private-bucket',
      Key: key,
      ContentType: 'image/png',
      ContentLength: body.length,
    });
    expect(provider.publicUrl(key)).toBeNull();
    expect(provider.publicUrl(legacyPublicKey)).toBe(
      `https://media.example.test/${legacyPublicKey}`,
    );
    expect(
      provider.publicUrl(
        `private/verifications/${destinationId}/${mediaId}.pdf`,
      ),
    ).toBeNull();
    expect(provider.publicUrl('public/destinations/../unsafe.png')).toBeNull();
    await expect(
      provider.deleteObject('public/arbitrary/key.png'),
    ).rejects.toThrow('Storage key is outside an allowed namespace.');
    await expect(
      provider.deleteObject('private/destinations/../unsafe.png'),
    ).rejects.toThrow('Storage key is outside an allowed namespace.');
  });
});
