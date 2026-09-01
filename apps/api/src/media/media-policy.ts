import { BadRequestException } from '@nestjs/common';
import { MediaRole, MediaStatus, MediaVisibility } from '@prisma/client';

type AttachableResource = 'business' | 'service' | 'destination' | 'attraction';

export interface MediaPublicCandidate {
  status: MediaStatus;
  visibility: MediaVisibility;
  id: string;
  originalFilename: string;
  mimeType: string;
  mediaType: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export function assertMediaRoleAllowed(
  resource: AttachableResource,
  role: MediaRole,
): void {
  if (resource !== 'business' && role === MediaRole.LOGO) {
    throw new BadRequestException(
      'LOGO media role is only valid for business media.',
    );
  }
}

export function toPublicMedia(media: MediaPublicCandidate) {
  if (
    media.status !== MediaStatus.READY ||
    media.visibility !== MediaVisibility.PUBLIC
  )
    return null;
  return {
    id: media.id,
    originalFilename: media.originalFilename,
    mimeType: media.mimeType,
    mediaType: media.mediaType,
    width: media.width,
    height: media.height,
    durationSeconds: media.durationSeconds,
  };
}
