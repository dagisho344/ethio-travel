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
