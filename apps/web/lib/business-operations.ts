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

export type ManagedRestaurantMenuItem = {
  id: string;
  section: string | null;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  available: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ManagedRestaurantMenu = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  items: ManagedRestaurantMenuItem[];
};

export type ManagedRestaurant = {
  service: {
    id: string;
    name: string;
    status: ManagedService['status'];
    category: { code: string; name: string };
  };
  detail: {
    id: string;
    cuisineTypes: string[];
    reservationSupported: boolean;
    deliverySupported: boolean;
  } | null;
  menus: ManagedRestaurantMenu[];
};

export type RestaurantDetailInput = {
  cuisineTypes?: string[];
  reservationSupported?: boolean;
  deliverySupported?: boolean;
};

export type RestaurantMenuInput = {
  name: string;
  description?: string | null;
  sortOrder?: number;
};

export type RestaurantMenuItemInput = {
  section?: string | null;
  name: string;
  description?: string | null;
  price: string;
  currency: string;
  sortOrder?: number;
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
export function getManagedRestaurant(
  businessId: string,
  serviceId: string,
): Promise<ManagedRestaurant> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/restaurant`,
  );
}
export function updateManagedRestaurant(
  businessId: string,
  serviceId: string,
  input: RestaurantDetailInput,
): Promise<ManagedRestaurant> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/restaurant`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}
export function createManagedRestaurantMenu(
  businessId: string,
  serviceId: string,
  input: RestaurantMenuInput,
): Promise<ManagedRestaurantMenu> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/restaurant/menus`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}
export function updateManagedRestaurantMenu(
  businessId: string,
  serviceId: string,
  menuId: string,
  input: Partial<RestaurantMenuInput>,
): Promise<ManagedRestaurantMenu> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/restaurant/menus/${menuId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}
export function restaurantMenuAction(
  businessId: string,
  serviceId: string,
  menuId: string,
  action: 'activate' | 'deactivate',
): Promise<ManagedRestaurantMenu> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/restaurant/menus/${menuId}/${action}`,
    { method: 'POST' },
  );
}
export function createManagedRestaurantMenuItem(
  businessId: string,
  serviceId: string,
  menuId: string,
  input: RestaurantMenuItemInput,
): Promise<ManagedRestaurantMenuItem> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/restaurant/menus/${menuId}/items`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}
export function updateManagedRestaurantMenuItem(
  businessId: string,
  serviceId: string,
  menuId: string,
  itemId: string,
  input: Partial<RestaurantMenuItemInput>,
): Promise<ManagedRestaurantMenuItem> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/restaurant/menus/${menuId}/items/${itemId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}
export function restaurantMenuItemAction(
  businessId: string,
  serviceId: string,
  menuId: string,
  itemId: string,
  action: 'available' | 'unavailable',
): Promise<ManagedRestaurantMenuItem> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/restaurant/menus/${menuId}/items/${itemId}/${action}`,
    { method: 'POST' },
  );
}
export type ManagedTourItineraryItem = {
  id: string;
  dayNumber: number;
  title: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ManagedTour = {
  service: {
    id: string;
    name: string;
    status: ManagedService['status'];
    category: { code: string; name: string };
  };
  detail: {
    id: string;
    durationDays: number | null;
    difficulty: string | null;
    meetingPoint: string | null;
    inclusions: string[];
    exclusions: string[];
  } | null;
  itinerary: ManagedTourItineraryItem[];
};

export type TourDetailInput = {
  durationDays?: number;
  difficulty?: string;
  meetingPoint?: string;
  inclusions?: string[];
  exclusions?: string[];
};

export type TourItineraryItemInput = {
  dayNumber: number;
  title: string;
  description?: string | null;
  sortOrder?: number;
};

export function getManagedTour(
  businessId: string,
  serviceId: string,
): Promise<ManagedTour> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/tour`,
  );
}

export function updateManagedTour(
  businessId: string,
  serviceId: string,
  input: TourDetailInput,
): Promise<ManagedTour> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/tour`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function createManagedTourItineraryItem(
  businessId: string,
  serviceId: string,
  input: TourItineraryItemInput,
): Promise<ManagedTourItineraryItem> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/tour/itinerary`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateManagedTourItineraryItem(
  businessId: string,
  serviceId: string,
  itemId: string,
  input: Partial<TourItineraryItemInput>,
): Promise<ManagedTourItineraryItem> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/tour/itinerary/${itemId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export type ManagedTransportSchedule = {
  id: string;
  departureAt: string;
  arrivalAt: string;
  fare: string;
  currency: string;
  capacity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ManagedTransportRoute = {
  id: string;
  originCity: { id: string; name: string; slug: string };
  destinationCity: { id: string; name: string; slug: string };
  createdAt: string;
  updatedAt: string;
  schedules: ManagedTransportSchedule[];
};

export type ManagedTransport = {
  service: {
    id: string;
    name: string;
    status: ManagedService['status'];
    category: { code: string; name: string };
  };
  detail: {
    id: string;
    mode: string | null;
    operatorName: string | null;
  } | null;
  routes: ManagedTransportRoute[];
};

export type TransportDetailInput = { mode?: string; operatorName?: string };
export type TransportRouteInput = {
  originCityId: string;
  destinationCityId: string;
};
export type TransportScheduleInput = {
  departureAt: string;
  arrivalAt: string;
  fare: string;
  currency: string;
  capacity: number;
};

export function getManagedTransport(
  businessId: string,
  serviceId: string,
): Promise<ManagedTransport> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/transport`,
  );
}

export function updateManagedTransport(
  businessId: string,
  serviceId: string,
  input: TransportDetailInput,
): Promise<ManagedTransport> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/transport`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function createManagedTransportRoute(
  businessId: string,
  serviceId: string,
  input: TransportRouteInput,
): Promise<ManagedTransportRoute> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/transport/routes`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateManagedTransportRoute(
  businessId: string,
  serviceId: string,
  routeId: string,
  input: Partial<TransportRouteInput>,
): Promise<ManagedTransportRoute> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/transport/routes/${routeId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function createManagedTransportSchedule(
  businessId: string,
  serviceId: string,
  routeId: string,
  input: TransportScheduleInput,
): Promise<ManagedTransportSchedule> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/transport/routes/${routeId}/schedules`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateManagedTransportSchedule(
  businessId: string,
  serviceId: string,
  routeId: string,
  scheduleId: string,
  input: Partial<TransportScheduleInput>,
): Promise<ManagedTransportSchedule> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/transport/routes/${routeId}/schedules/${scheduleId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function transportScheduleAction(
  businessId: string,
  serviceId: string,
  routeId: string,
  scheduleId: string,
  action: 'activate' | 'deactivate',
): Promise<ManagedTransportSchedule> {
  return bffJson(
    `/api/businesses/manage/${businessId}/services/${serviceId}/transport/routes/${routeId}/schedules/${scheduleId}/${action}`,
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
