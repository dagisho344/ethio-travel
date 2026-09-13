import { Injectable } from '@nestjs/common';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import {
  PutStorageObject,
  StorageObjectMetadata,
  StorageProvider,
} from './storage.provider';

@Injectable()
export class DevelopmentStorageProvider implements StorageProvider {
  private readonly root = resolve(
    process.env.STORAGE_DEVELOPMENT_ROOT ?? 'var/storage',
  );

  async putObject(input: PutStorageObject): Promise<StorageObjectMetadata> {
    const target = this.pathFor(input.key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, input.body, { flag: 'wx' });
    return {
      key: input.key,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    };
  }

  async getObjectMetadata(key: string): Promise<StorageObjectMetadata | null> {
    try {
      const object = await stat(this.pathFor(key));
      return {
        key,
        mimeType: 'application/octet-stream',
        sizeBytes: object.size,
      };
    } catch {
      return null;
    }
  }

  readObject(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async deleteObject(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  publicUrl(key: string): string | null {
    void key;
    return null;
  }

  signedPrivateReadUrl(
    key: string,
    expiresInSeconds: number,
  ): Promise<string | null> {
    void key;
    void expiresInSeconds;
    return Promise.resolve(null);
  }

  private pathFor(key: string): string {
    if (
      !/^(?:public\/businesses|private\/verifications)\/[0-9a-f-]+\/[0-9a-f-]+\.[a-z0-9]+$/i.test(
        key,
      )
    ) {
      throw new Error('Storage key is outside an allowed namespace.');
    }
    const target = resolve(this.root, key);
    if (!target.startsWith(`${this.root}${sep}`))
      throw new Error('Unsafe storage key.');
    return target;
  }
}
