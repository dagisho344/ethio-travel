import { bffJson } from './private-api';

export type BusinessLocationStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type BusinessWeekday =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';
export type OperatingHour = {
  dayOfWeek: BusinessWeekday;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
};
export type ManagedLocation = {
  id: string;
  label: string;
  addressLine1: string;
  addressLine2: string | null;
  neighborhood: string | null;
  postalCode: string | null;
  latitude: number | string;
  longitude: number | string;
  timezone: string;
  isPrimary: boolean;
  status: BusinessLocationStatus;
  city: {
    id: string;
    name: string;
    slug: string;
    region: { id: string; name: string; slug: string };
  };
  destination: { id: string; name: string; slug: string } | null;
  operatingHours: OperatingHour[];
};
export type LocationInput = {
  label: string;
  cityId: string;
  destinationId?: string | null;
  addressLine1: string;
  addressLine2?: string;
  neighborhood?: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  status?: 'ACTIVE' | 'INACTIVE';
};
const base = (businessId: string) =>
  `/api/businesses/manage/${businessId}/locations`;
export const getLocations = (businessId: string) =>
  bffJson<ManagedLocation[]>(base(businessId));
export const createLocation = (businessId: string, input: LocationInput) =>
  bffJson<ManagedLocation>(base(businessId), {
    method: 'POST',
    body: JSON.stringify(input),
  });
export const updateLocation = (
  businessId: string,
  id: string,
  input: Partial<LocationInput>,
) =>
  bffJson<ManagedLocation>(`${base(businessId)}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
export const makeLocationPrimary = (businessId: string, id: string) =>
  bffJson<ManagedLocation>(`${base(businessId)}/${id}/make-primary`, {
    method: 'POST',
  });
export const archiveLocation = (businessId: string, id: string) =>
  bffJson<ManagedLocation>(`${base(businessId)}/${id}/archive`, {
    method: 'POST',
  });
export const saveLocationHours = (
  businessId: string,
  id: string,
  hours: OperatingHour[],
) =>
  bffJson<OperatingHour[]>(`${base(businessId)}/${id}/hours`, {
    method: 'PUT',
    body: JSON.stringify({ hours }),
  });
