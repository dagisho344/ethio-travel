import { bffJson } from './private-api';
import type {
  BusinessVerification,
  VerificationDocument,
} from './business-verifications';
import type { PaginatedResponse } from './types';

export type AdminVerification = BusinessVerification & {
  business: {
    id: string;
    name: string;
    status: string;
    verificationSummary: string;
    locations: Array<{
      id: string;
      label: string;
      addressLine1: string;
      city: { name: string };
      destination: { name: string } | null;
    }>;
  };
  applicant: { id: string; email: string };
  reviewer: { id: string; email: string } | null;
  documents: VerificationDocument[];
};
export type PrivateDocumentAccess =
  | { delivery: 'SIGNED_URL'; url: string; expiresInSeconds: number }
  | { delivery: 'PROTECTED_STREAM'; url: null; expiresInSeconds: 0 };

export const getAdminVerifications = (query = '') =>
  bffJson<PaginatedResponse<AdminVerification>>(
    `/api/admin/verifications${query}`,
  );
export const getAdminVerification = (id: string) =>
  bffJson<AdminVerification>(`/api/admin/verifications/${id}`);
export const approveVerification = (id: string, adminNotes?: string) =>
  bffJson<AdminVerification>(`/api/admin/verifications/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ adminNotes }),
  });
export const rejectVerification = (
  id: string,
  rejectionReason: string,
  adminNotes?: string,
) =>
  bffJson<AdminVerification>(`/api/admin/verifications/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ rejectionReason, adminNotes }),
  });
export const getPrivateDocumentAccess = (
  verificationId: string,
  documentId: string,
) =>
  bffJson<PrivateDocumentAccess>(
    `/api/admin/verifications/${verificationId}/documents/${documentId}/access`,
  );
export const protectedDocumentContentPath = (
  verificationId: string,
  documentId: string,
) =>
  `/api/admin/verifications/${verificationId}/documents/${documentId}/content`;
