import { BffRequestError, bffJson } from './private-api';

export type MediaRole = 'LOGO' | 'HERO' | 'GALLERY';
export type MediaStatus = 'PENDING_UPLOAD' | 'READY' | 'FAILED' | 'ARCHIVED';
export type ManagedBusinessMedia = {
  id: string;
  role: MediaRole;
  sortOrder: number;
  altText: string | null;
  caption: string | null;
  media: {
    id: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    status: MediaStatus;
  };
};

const base = (businessId: string) =>
  `/api/businesses/manage/${businessId}/media`;

export const getBusinessMedia = (businessId: string) =>
  bffJson<ManagedBusinessMedia[]>(base(businessId));
export const updateBusinessMedia = (
  businessId: string,
  mediaId: string,
  input: { altText?: string | null; caption?: string | null },
) =>
  bffJson<ManagedBusinessMedia>(`${base(businessId)}/${mediaId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
export const archiveBusinessMedia = (businessId: string, mediaId: string) =>
  bffJson<ManagedBusinessMedia>(`${base(businessId)}/${mediaId}/archive`, {
    method: 'POST',
  });
export const reorderBusinessMedia = (businessId: string, mediaIds: string[]) =>
  bffJson<ManagedBusinessMedia[]>(`${base(businessId)}/reorder`, {
    method: 'POST',
    body: JSON.stringify({ mediaIds }),
  });

export async function uploadBusinessMedia(
  businessId: string,
  role: MediaRole,
  file: File,
  fields: { altText?: string; caption?: string } = {},
): Promise<ManagedBusinessMedia> {
  const form = new FormData();
  form.set('role', role);
  form.set('file', file, file.name);
  if (fields.altText) form.set('altText', fields.altText);
  if (fields.caption) form.set('caption', fields.caption);
  return uploadForm<ManagedBusinessMedia>(base(businessId), form);
}

export async function uploadForm<T>(path: string, form: FormData): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    body: form,
    cache: 'no-store',
  });
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new BffRequestError(
        'The upload response was invalid.',
        response.status,
      );
    }
  }
  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof data.message === 'string'
        ? data.message
        : 'Upload failed.';
    throw new BffRequestError(message, response.status);
  }
  return data as T;
}
