import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';
import { AppConfig } from '../config/app.config';
import {
  PutStorageObject,
  StorageObjectMetadata,
  StorageProvider,
} from './storage.provider';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    this.client = new S3Client({
      credentials: {
        accessKeyId: config.get('s3AccessKeyId', { infer: true }),
        secretAccessKey: config.get('s3SecretAccessKey', { infer: true }),
      },
      endpoint: config.get('s3Endpoint', { infer: true }),
      forcePathStyle: config.get('s3ForcePathStyle', { infer: true }),
      region: config.get('s3Region', { infer: true }),
    });
  }

  async putObject(input: PutStorageObject): Promise<StorageObjectMetadata> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketFor(input.key),
        Key: input.key,
        Body: input.body,
        ContentLength: input.sizeBytes,
        ContentType: input.mimeType,
      }),
    );
    return {
      key: input.key,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    };
  }

  async getObjectMetadata(key: string): Promise<StorageObjectMetadata | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucketFor(key), Key: key }),
      );
      return {
        key,
        mimeType: result.ContentType ?? 'application/octet-stream',
        sizeBytes: result.ContentLength ?? 0,
      };
    } catch (error) {
      if (this.isNotFound(error)) return null;
      throw error;
    }
  }

  async readObject(key: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucketFor(key), Key: key }),
    );
    if (!result.Body) throw new Error('Storage object has no body.');
    return this.toBuffer(result.Body);
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucketFor(key), Key: key }),
    );
  }

  publicUrl(key: string): string | null {
    if (!this.isPublicKey(key)) return null;
    const base = this.config.get('s3PublicBaseUrl', { infer: true });
    return base ? `${base.replace(/\/$/, '')}/${encodeURI(key)}` : null;
  }

  signedPrivateReadUrl(
    key: string,
    expiresInSeconds: number,
  ): Promise<string | null> {
    if (this.isPublicKey(key)) return Promise.resolve(null);
    const configuredMax = this.config.get('s3SignedUrlTtlSeconds', {
      infer: true,
    });
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucketFor(key), Key: key }),
      { expiresIn: Math.min(Math.max(expiresInSeconds, 60), configuredMax) },
    );
  }

  private bucketFor(key: string): string {
    if (this.isPublicKey(key))
      return this.config.get('s3BucketPublic', { infer: true });
    if (key.startsWith('private/verifications/'))
      return this.config.get('s3BucketPrivate', { infer: true });
    throw new Error('Storage key is outside an allowed namespace.');
  }

  private isPublicKey(key: string): boolean {
    return /^public\/businesses\/[0-9a-f-]+\/[0-9a-f-]+\.[a-z0-9]+$/i.test(key);
  }

  private isNotFound(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error.name === 'NotFound' || error.name === 'NoSuchKey')
    );
  }

  private async toBuffer(body: unknown): Promise<Buffer> {
    if (this.hasTransformToByteArray(body)) {
      const bytes = await body.transformToByteArray();
      return Buffer.from(bytes);
    }
    if (body instanceof Readable) {
      const chunks: Uint8Array[] = [];
      for await (const chunk of body as AsyncIterable<unknown>) {
        if (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array) {
          chunks.push(chunk);
          continue;
        }
        throw new Error(
          'Storage object stream contained an unsupported chunk.',
        );
      }
      return Buffer.concat(chunks);
    }
    if (this.hasArrayBuffer(body)) return Buffer.from(await body.arrayBuffer());
    throw new Error('Storage object body has an unsupported stream type.');
  }

  private hasTransformToByteArray(
    value: unknown,
  ): value is { transformToByteArray(): Promise<Uint8Array> } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'transformToByteArray' in value &&
      typeof value.transformToByteArray === 'function'
    );
  }

  private hasArrayBuffer(
    value: unknown,
  ): value is { arrayBuffer(): Promise<ArrayBuffer> } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'arrayBuffer' in value &&
      typeof value.arrayBuffer === 'function'
    );
  }
}
