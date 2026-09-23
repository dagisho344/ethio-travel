import type { PublicMedia } from './types';

const publicApiBase =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/**
 * Builds a browser URL only for the API-owned public-media endpoint. The API
 * returns an absolute-path contract, while NEXT_PUBLIC_API_URL includes its
 * version prefix, so string concatenation would duplicate `/api/v1`.
 */
export function publicMediaUrl(media: Pick<PublicMedia, 'accessPath'>): string {
  if (!media.accessPath.startsWith('/api/v1/media/public/')) {
    throw new Error('Unexpected public media access path.');
  }

  return new URL(media.accessPath, publicApiBase).toString();
}
