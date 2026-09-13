export type StorageObjectMetadata = {
  key: string;
  mimeType: string;
  sizeBytes: number;
};

export type PutStorageObject = StorageObjectMetadata & {
  body: Buffer;
};

export interface StorageProvider {
  putObject(input: PutStorageObject): Promise<StorageObjectMetadata>;
  getObjectMetadata(key: string): Promise<StorageObjectMetadata | null>;
  readObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
  publicUrl(key: string): string | null;
  signedPrivateReadUrl(
    key: string,
    expiresInSeconds: number,
  ): Promise<string | null>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
