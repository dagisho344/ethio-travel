import { BffRequestError, bffJson, queryString } from './private-api';
import type { PaginatedResponse } from './types';

export type ManagedBusinessStatus =
  'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
export type BusinessVerificationState =
  'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type ManagedBusinessRole = 'OWNER' | 'MANAGER' | 'STAFF';

type CategorySummary = { id: string; code: string; name: string };
type RegionSummary = { id: string; name: string; slug: string };
type CitySummary = {
  id: string;
  name: string;
  slug: string;
  region: RegionSummary;
};
type DestinationSummary = { id: string; name: string; slug: string };

export type ManagedBusiness = {
  id: string;
  name: string;
  slug: string;
  description: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  addressLine1: string;
  addressLine2: string | null;
  neighborhood: string | null;
  postalCode: string | null;
  latitude: number | string;
  longitude: number | string;
  status: ManagedBusinessStatus;
  verificationSummary: BusinessVerificationState;
  category: CategorySummary;
  city: CitySummary;
  destination: DestinationSummary | null;
  currentMember: { role: ManagedBusinessRole; status: 'ACTIVE' };
  createdAt: string;
  updatedAt: string;
};

export type BusinessDraftInput = {
  cityId: string;
  destinationId?: string;
  categoryId: string;
  name: string;
  description: string;
  phone?: string;
  email?: string;
  website?: string;
  addressLine1: string;
  addressLine2?: string;
  neighborhood?: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
};

export type ManagedBusinessesResponse = PaginatedResponse<ManagedBusiness>;

export async function getManagedBusinesses(
  page = 1,
): Promise<ManagedBusinessesResponse> {
  return bffJson<ManagedBusinessesResponse>(
    `/api/businesses/manage${queryString({ page, limit: 12 })}`,
  );
}

export async function getManagedBusiness(
  businessId: string,
): Promise<ManagedBusiness> {
  return bffJson<ManagedBusiness>(`/api/businesses/manage/${businessId}`);
}

export async function createBusinessDraft(
  input: BusinessDraftInput,
): Promise<ManagedBusiness> {
  return bffJson<ManagedBusiness>('/api/businesses/manage', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateManagedBusiness(
  businessId: string,
  input: Partial<BusinessDraftInput>,
): Promise<ManagedBusiness> {
  return bffJson<ManagedBusiness>(`/api/businesses/manage/${businessId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function requestErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof BffRequestError)) return fallback;
  if (error.status === 401)
    return 'Your session has ended. Please sign in again.';
  if (error.status === 403) return 'You do not have access to this business.';
  if (error.status === 404) return 'This business is no longer available.';
  if (error.status === 409) return error.message;
  return error.message || fallback;
}

export function verificationLabel(state: BusinessVerificationState): string {
  return state
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^\w/, (value) => value.toUpperCase());
}

export function nextBusinessAction(business: ManagedBusiness): string {
  if (business.status === 'SUSPENDED') return 'Business is suspended';
  if (business.status === 'ARCHIVED') return 'View business history';
  if (business.verificationSummary === 'PENDING') return 'Verification pending';
  if (business.verificationSummary === 'VERIFIED') return 'Manage business';
  if (business.verificationSummary === 'REJECTED')
    return 'Review verification feedback';
  return 'Continue setup';
}

export function canEditBusiness(business: ManagedBusiness): boolean {
  return (
    business.status !== 'ARCHIVED' &&
    business.currentMember.role !== 'STAFF' &&
    business.currentMember.status === 'ACTIVE'
  );
}
