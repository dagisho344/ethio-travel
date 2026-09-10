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

export type ConversationStatus = 'ACTIVE' | 'ARCHIVED';
export type ConversationMemberRole = 'TRAVELER' | 'BUSINESS_MEMBER';
export type ConversationMemberStatus = 'ACTIVE' | 'ARCHIVED';
export type MessageStatus = 'SENT' | 'DELETED';

export interface ConversationMember {
  id: string;
  role: ConversationMemberRole;
  status: ConversationMemberStatus;
  lastReadAt: string | null;
  createdAt: string;
  displayName: string;
}

export interface ConversationBookingContext {
  id: string;
  reference: string;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  service: BookingSummaryTarget;
}

export interface Conversation {
  id: string;
  businessId: string;
  bookingId: string | null;
  subject: string | null;
  status: ConversationStatus;
  lastMessageAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  business: BookingSummaryTarget;
  booking: ConversationBookingContext | null;
  lastMessage: { body: string; createdAt: string } | null;
  members: ConversationMember[];
}

export interface ConversationListItem extends Conversation {
  unreadCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  body: string;
  status: MessageStatus;
  createdAt: string;
  updatedAt: string;
  sender: { id: string; displayName: string };
}

export type ConversationListResponse = PaginatedResponse<ConversationListItem>;
export type MessageListResponse = PaginatedResponse<Message>;

export interface CreateConversationInput {
  businessId: string;
  bookingId?: string;
  subject?: string;
}

export type NotificationType =
  | 'BOOKING_CREATED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_REJECTED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_COMPLETED'
  | 'BOOKING_NO_SHOW'
  | 'PAYMENT_SUCCEEDED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_REFUNDED'
  | 'MESSAGE_RECEIVED'
  | 'BUSINESS_VERIFICATION_APPROVED'
  | 'BUSINESS_VERIFICATION_REJECTED'
  | 'REVIEW_PUBLISHED'
  | 'REVIEW_REJECTED'
  | 'REVIEW_HIDDEN';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NotificationListResponse = PaginatedResponse<Notification>;
export interface UnreadNotificationCount {
  count: number;
}

export type RealtimeMessageEvent = Message;
export type RealtimeNotificationEvent = Notification & {
  recipientUserId: string;
};

export interface SocketTicketResponse {
  socketTicket: string;
}

export type TripStatus =
  'DRAFT' | 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';

export type TripItemType =
  'DESTINATION' | 'ATTRACTION' | 'BUSINESS' | 'SERVICE' | 'BOOKING' | 'CUSTOM';

export interface TripLocationSummary {
  id: string;
  name: string;
  slug: string;
}

export interface TripBookingContext {
  id: string;
  reference: string;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  subtotal: string | number;
  currency: string | null;
  service: BookingSummaryTarget;
  business: BookingSummaryTarget;
}

export interface TripItem {
  id: string;
  type: TripItemType;
  targetId: string | null;
  title: string | null;
  startTime: string | null;
  endTime: string | null;
  position: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  booking: TripBookingContext | null;
}

export interface TripDay {
  id: string;
  date: string;
  dayNumber: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: TripItem[];
}

export interface TripCostEstimate {
  amount: string | number | null;
  currency: string | null;
  reason: 'MULTIPLE_OR_UNKNOWN_CURRENCIES' | null;
}

export interface Trip {
  id: string;
  title: string;
  originCity: TripLocationSummary | null;
  destinationCity: TripLocationSummary | null;
  primaryDestination: TripLocationSummary | null;
  startDate: string;
  endDate: string;
  status: TripStatus;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  days: TripDay[];
  dayCount: number;
  estimatedBookingCost: TripCostEstimate | null;
}

export type TripListItem = Omit<Trip, 'days' | 'estimatedBookingCost'>;
export type TripListResponse = PaginatedResponse<TripListItem>;

export type AiIntent =
  | 'GENERAL_TRAVEL'
  | 'DESTINATION_DISCOVERY'
  | 'BUSINESS_RECOMMENDATION'
  | 'SERVICE_RECOMMENDATION'
  | 'ATTRACTION_RECOMMENDATION'
  | 'TRIP_ITINERARY'
  | 'TRIP_IMPROVEMENT';
export type AiMessageRole = 'USER' | 'ASSISTANT';
export type AiSuggestionStatus =
  'PENDING' | 'APPLYING' | 'APPLIED' | 'DISMISSED' | 'INVALID';

export interface AiKnownPrice {
  amount: string;
  currency: string;
}

export interface AiRecommendation {
  id: string | null;
  entityType: Extract<
    TripItemType,
    'DESTINATION' | 'ATTRACTION' | 'BUSINESS' | 'SERVICE'
  >;
  entityId: string;
  name: string;
  slug: string;
  category: string | null;
  location: string | null;
  knownPrice: AiKnownPrice | null;
  availability: 'UNKNOWN';
  reason: string;
  suggestedDay: number | null;
  notes: string | null;
}

export interface AiStoredSuggestion {
  id: string;
  entityType: TripItemType;
  entityId: string;
  name: string;
  reason: string;
  suggestedDay: number;
  suggestedDate: string;
  notes: string | null;
  status: AiSuggestionStatus;
  appliedTripItemId: string | null;
  createdAt: string;
  appliedAt: string | null;
}

export interface AiMessage {
  id: string;
  role: AiMessageRole;
  content: string;
  createdAt: string;
}

export interface AiConversation {
  id: string;
  tripId: string | null;
  title: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  trip: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
  } | null;
  messages: AiMessage[];
  suggestions: AiStoredSuggestion[];
}

export type AiConversationListResponse = PaginatedResponse<AiConversation>;
export interface AiMessageResponse {
  conversation: AiConversation;
  assistantMessage: string;
  recommendations: AiRecommendation[];
}
export interface AiRecommendationsResponse {
  summary: string;
  recommendations: AiRecommendation[];
}
