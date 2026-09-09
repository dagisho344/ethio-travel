import type { TripItemType, TripStatus } from './types';

export const tripStatusOptions: Array<{ value: TripStatus; label: string }> = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export const itemTypeOptions: Array<{
  value: TripItemType;
  label: string;
}> = [
  { value: 'DESTINATION', label: 'Destination' },
  { value: 'ATTRACTION', label: 'Attraction' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'BOOKING', label: 'Booking' },
  { value: 'CUSTOM', label: 'Custom note' },
];

export function formatTripDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('en-ET', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatTripDateRange(
  startDate: string,
  endDate: string,
): string {
  const start = formatTripDate(startDate);
  const end = formatTripDate(endDate);
  return start === end ? start : `${start} – ${end}`;
}

export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function statusLabel(status: TripStatus): string {
  return (
    tripStatusOptions.find((option) => option.value === status)?.label ?? status
  );
}
