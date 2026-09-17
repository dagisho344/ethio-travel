import { BffRequestError, bffJson, queryString } from './private-api';
import type { PaginatedResponse, ReviewStatus } from './types';

export type BusinessDashboard = {
  business: {
    id: string;
    name: string;
    status: 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
    verificationSummary: 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  };
  primaryLocation: {
    id: string;
    label: string;
    addressLine1: string;
    city: { id: string; name: string };
    destination: { id: string; name: string } | null;
  } | null;
  services: { total: number; active: number };
  bookings: {
    pending: number;
    confirmedUpcoming: number;
    completed: number;
    cancelled: number;
  };
  reviews: {
    averageRating: number | null;
    publishedCount: number;
    unansweredCount: number;
  };
  revenue: Array<{
    currency: string;
    gross: string;
    refunded: string;
    net: string;
  }>;
};

export type ManagedCustomer = {
  userId: string;
  displayName: string;
  bookingCount: number;
  mostRecentBookingAt: string | null;
  upcomingBookingCount: number;
  completedBookingCount: number;
};

export type ManagedBusinessReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  publishedAt: string | null;
  createdAt: string;
  service: { id: string; name: string } | null;
  author: { displayName: string };
  businessResponse: {
    id: string;
    body: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type ManagedService = {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  price: string | number | null;
  currency: string | null;
  pricingModel: string;
  durationMinutes: number | null;
  status: 'DRAFT' | 'PUBLISHED' | 'INACTIVE' | 'ARCHIVED';
  category: {
    id: string;
    code: string;
    family: 'ACCOMMODATION' | 'RESTAURANT' | 'TOUR' | 'TRANSPORT' | 'OTHER';
    name: string;
  };
  bookingConfig: { enabled: boolean } | null;
};

export type ManagedRoomType = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  basePrice: string;
  currency: string;
  quantity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ManagedAccommodation = {
  service: {
    id: string;
    name: string;
    status: ManagedService['status'];
    category: { code: string; name: string };
  };
  detail: {
    id: string;
    starClass: number | null;
    checkInTime: string | null;
    checkOutTime: string | null;
  } | null;
  roomTypes: ManagedRoomType[];
};

export type AccommodationDetailInput = {
  starClass?: number | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
};

export type RoomTypeInput = {
  name: string;
  description?: string | null;
  capacity: number;
  basePrice: string;
  currency: string;
  quantity: number;
};

export function getBusinessDashboard(
  businessId: string,
): Promise<BusinessDashboard> {
  return bffJson(`/api/businesses/manage/${businessId}/dashboard`);
}
export function getBusinessCustomers(
  businessId: string,
  page = 1,
): Promise<PaginatedResponse<ManagedCustomer>> {
  return bffJson(
    `/api/businesses/manage/${businessId}/customers${queryString({ page, limit: 20 })}`,
  );
}
export function getBusinessReviews(
  businessId: string,
  page = 1,
  status?: ReviewStatus,
): Promise<PaginatedResponse<ManagedBusinessReview>> {
  return bffJson(
    `/api/businesses/manage/${businessId}/reviews${queryString({ page, limit: 20, status })}`,
  );
}
export function respondToReview(
  businessId: string,
  reviewId: string,
  body: string,
) {
  return bffJson(
    `/api/businesses/manage/${businessId}/reviews/${reviewId}/response`,
    { method: 'POST', body: JSON.stringify({ body }) },
  );
}
export function getManagedServices(
  businessId: string,
  page = 1,
): Promise<PaginatedResponse<ManagedService>> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services${queryString({ page, limit: 30 })}`,
  );
}
export function createManagedService(
  businessId: string,
  input: Record<string, string | number | boolean | null>,
) {
  return bffJson(`/api/businesses/manage/${businessId}/services`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
export function updateManagedService(
  businessId: string,
  serviceId: string,
  input: Record<string, string | number | boolean | null>,
) {
  return bffJson(`/api/businesses/manage/${businessId}/services/${serviceId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
export function serviceAction(
  businessId: string,
  serviceId: string,
  action: 'publish' | 'unpublish' | 'archive',
) {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/${action}`,
    { method: 'POST' },
  );
}
export function getManagedAccommodation(
  businessId: string,
  serviceId: string,
): Promise<ManagedAccommodation> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/accommodation`,
  );
}
export function updateManagedAccommodation(
  businessId: string,
  serviceId: string,
  input: AccommodationDetailInput,
): Promise<ManagedAccommodation> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/accommodation`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}
export function createManagedRoomType(
  businessId: string,
  serviceId: string,
  input: RoomTypeInput,
): Promise<ManagedRoomType> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/accommodation/rooms`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}
export function updateManagedRoomType(
  businessId: string,
  serviceId: string,
  roomTypeId: string,
  input: Partial<RoomTypeInput>,
): Promise<ManagedRoomType> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/accommodation/rooms/${roomTypeId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}
export function roomTypeAction(
  businessId: string,
  serviceId: string,
  roomTypeId: string,
  action: 'activate' | 'deactivate',
): Promise<ManagedRoomType> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/accommodation/rooms/${roomTypeId}/${action}`,
    { method: 'POST' },
  );
}
export function operationError(error: unknown, fallback: string): string {
  if (!(error instanceof BffRequestError)) return fallback;
  if (error.status === 403)
    return 'You do not have permission for this business operation.';
  if (error.status === 409) return error.message;
  return error.message || fallback;
}
