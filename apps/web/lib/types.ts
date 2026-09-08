export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
export interface Category {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}
export interface LocationSummary {
  name: string;
  slug: string;
}
export interface Destination {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  fullDescription?: string;
  latitude: string | number;
  longitude: string | number;
  city?: LocationSummary;
  region?: LocationSummary;
}
export interface Attraction {
  id: string;
  name: string;
  slug: string;
  category: string | { name: string; code?: string };
  description: string;
  latitude: string | number;
  longitude: string | number;
}
export interface Business {
  id: string;
  name: string;
  slug: string;
  description: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  latitude: string | number;
  longitude: string | number;
  category?: Category;
  city?: LocationSummary;
  region?: LocationSummary;
  destination?: LocationSummary | null;
}
export type PricingModel =
  | 'FIXED'
  | 'PER_PERSON'
  | 'PER_NIGHT'
  | 'PER_HOUR'
  | 'PER_DAY'
  | 'STARTING_FROM'
  | 'FREE'
  | 'CONTACT_FOR_PRICE';
export interface Service {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description?: string;
  pricingModel: PricingModel;
  price?: string | number | null;
  currency?: string | null;
  category?: Category;
  business?: LocationSummary & { category?: Category };
  city?: LocationSummary;
  region?: LocationSummary;
  destination?: LocationSummary | null;
}
export type SearchResultType =
  'destination' | 'attraction' | 'business' | 'service';
export interface SearchResult {
  type: SearchResultType;
  id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  category?: Category | { name: string; code?: string };
  location: {
    region?: LocationSummary;
    city?: LocationSummary;
    destination?: LocationSummary | null;
    business?: LocationSummary;
  };
  price?: string | number | null;
  currency?: string | null;
  pricingModel?: PricingModel;
}
export interface MapPlace {
  type: SearchResultType;
  id: string;
  name: string;
  slug: string;
  latitude: string | number;
  longitude: string | number;
  category?: Category | { name: string; code?: string };
  location: SearchResult['location'];
}
export interface ApiErrorShape {
  message?: string | string[];
  statusCode?: number;
}
export type FavoriteTargetType =
  'BUSINESS' | 'SERVICE' | 'DESTINATION' | 'ATTRACTION';

export type FavoriteTarget =
  | {
      type: 'BUSINESS';
      id: string;
      name: string;
      slug: string;
      description: string;
      category: Category;
      city: LocationSummary;
      region: LocationSummary;
      destination: LocationSummary | null;
    }
  | {
      type: 'SERVICE';
      id: string;
      name: string;
      slug: string;
      shortDescription: string;
      pricingModel: PricingModel;
      price?: string | number | null;
      currency?: string | null;
      category: Category;
      business: LocationSummary;
      city: LocationSummary;
      region: LocationSummary;
      destination: LocationSummary | null;
    }
  | {
      type: 'DESTINATION';
      id: string;
      name: string;
      slug: string;
      shortDescription: string;
      city: LocationSummary;
      region: LocationSummary;
    }
  | {
      type: 'ATTRACTION';
      id: string;
      name: string;
      slug: string;
      category: string;
      description: string;
      destination: LocationSummary;
      city: LocationSummary;
      region: LocationSummary;
    };

export interface Favorite {
  id: string;
  createdAt: string;
  target: FavoriteTarget;
}
export type ReviewTargetType = FavoriteTargetType;
export type ReviewStatus = 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'REJECTED';

export type ReviewTargetSummary = FavoriteTarget;

export interface MyReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  moderationNote: string | null;
  moderatedAt: string | null;
  publishedAt: string | null;
  hiddenAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  target: ReviewTargetSummary;
}

export interface PublicReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  author: { displayName: string };
  publishedAt: string | null;
  createdAt: string;
}

export interface ReviewSummary {
  averageRating: number | null;
  reviewCount: number;
  ratingDistribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export type BookingMode = 'DATE' | 'DATE_RANGE' | 'TIME_SLOT';
export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED_BY_TRAVELER'
  | 'CANCELLED_BY_BUSINESS'
  | 'COMPLETED'
  | 'NO_SHOW';
export type PaymentStatus =
  | 'NOT_REQUIRED'
  | 'UNPAID'
  | 'PENDING'
  | 'PAID'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'FAILED';
export type PaymentProvider = 'DEVELOPMENT' | 'STRIPE';
export type PaymentTransactionType =
  | 'PAYMENT_INITIATED'
  | 'PROVIDER_AUTHORIZATION'
  | 'PAYMENT_CAPTURED'
  | 'PAYMENT_FAILED'
  | 'REFUND_INITIATED'
  | 'REFUND_SUCCEEDED'
  | 'REFUND_FAILED';
export type PaymentTransactionStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';
export type PaymentRefundStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';

export interface PaymentBookingSummary {
  id: string;
  reference: string;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  service: BookingSummaryTarget;
  business: BookingSummaryTarget;
}

export interface PaymentTransaction {
  id: string;
  type: PaymentTransactionType;
  amount: string | number;
  currency: string;
  status: PaymentTransactionStatus;
  createdAt: string;
}

export interface PaymentRefund {
  id: string;
  amount: string | number;
  currency: string;
  reason: string | null;
  status: PaymentRefundStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface Payment {
  id: string;
  bookingId: string;
  travelerId?: string;
  businessId?: string;
  provider: PaymentProvider;
  providerPaymentId: string | null;
  amount: string | number;
  currency: string;
  status: PaymentStatus;
  method: string | null;
  paidAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
  booking: PaymentBookingSummary;
  transactions: PaymentTransaction[];
  refunds: PaymentRefund[];
}

export type PaymentInitiationResponse = Payment & {
  providerResponse?: Record<string, string>;
};

export type PaymentListResponse = PaginatedResponse<Payment>;

export interface ServiceBookingConfig {
  id?: string;
  serviceId?: string;
  enabled: boolean;
  bookingMode: BookingMode;
  timezone: string;
  capacity: number;
  minQuantity: number;
  maxQuantity: number;
  minDurationMinutes?: number | null;
  maxDurationMinutes?: number | null;
  advanceNoticeMinutes: number;
}

export interface AvailabilityResponse {
  serviceId: string;
  bookingMode?: BookingMode;
  timezone?: string;
  requestedQuantity: number;
  capacity: number;
  reserved: number;
  remaining: number;
  available: boolean;
  startAt: string;
  endAt: string;
}

export interface BookingStatusHistoryItem {
  id: string;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  note: string | null;
  createdAt: string;
}

export interface BookingSummaryTarget {
  id: string;
  name: string;
  slug: string;
}

export interface Booking {
  id: string;
  reference: string;
  startAt: string;
  endAt: string;
  quantity: number;
  guestCount: number | null;
  unitPrice: string | number | null;
  subtotal: string | number;
  currency: string | null;
  pricingModelSnapshot: PricingModel;
  bookingModeSnapshot: BookingMode;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  travelerNote: string | null;
  businessNote: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  service: BookingSummaryTarget;
  business: BookingSummaryTarget;
  history: BookingStatusHistoryItem[];
}

export type BookingListResponse = PaginatedResponse<Booking>;
export type BusinessBookingListResponse = PaginatedResponse<Booking>;
