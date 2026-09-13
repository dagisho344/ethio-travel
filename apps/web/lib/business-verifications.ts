import { uploadForm } from './business-media';
import { bffJson } from './private-api';
import type { PaginatedResponse } from './types';

export type VerificationStatus =
  'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type VerificationDocumentType =
  'BUSINESS_LICENSE' | 'TAX_DOCUMENT' | 'OWNER_ID' | 'ADDRESS_PROOF' | 'OTHER';
export type VerificationDocument = {
  id: string;
  type: VerificationDocumentType;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  status: 'PENDING_UPLOAD' | 'READY' | 'FAILED' | 'ARCHIVED';
  finalizedAt: string | null;
  createdAt: string;
};
export type VerificationCompleteness = {
  required: Array<{ type: VerificationDocumentType; complete: boolean }>;
  readyToSubmit: boolean;
};
export type BusinessVerification = {
  id: string;
  businessId: string;
  status: VerificationStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  adminNotes: string | null;
  createdAt: string;
  documents: VerificationDocument[];
  completeness: VerificationCompleteness;
};

const base = (businessId: string) =>
  `/api/businesses/manage/${businessId}/verification`;
export const getVerificationDraft = (businessId: string) =>
  bffJson<BusinessVerification | null>(`${base(businessId)}/draft`);
export const createVerificationDraft = (businessId: string) =>
  bffJson<BusinessVerification>(`${base(businessId)}/draft`, {
    method: 'POST',
  });
export const getVerificationHistory = (businessId: string) =>
  bffJson<PaginatedResponse<BusinessVerification>>(
    `${base(businessId)}/history`,
  );
export const submitVerification = (
  businessId: string,
  verificationId: string,
) =>
  bffJson<BusinessVerification>(
    `${base(businessId)}/${verificationId}/submit`,
    { method: 'POST' },
  );
export const getVerificationCompleteness = (
  businessId: string,
  verificationId: string,
) =>
  bffJson<VerificationCompleteness>(
    `${base(businessId)}/${verificationId}/completeness`,
  );
export function uploadVerificationDocument(
  businessId: string,
  verificationId: string,
  type: VerificationDocumentType,
  file: File,
) {
  const form = new FormData();
  form.set('type', type);
  form.set('file', file, file.name);
  return uploadForm<VerificationDocument>(
    `${base(businessId)}/${verificationId}/documents`,
    form,
  );
}
