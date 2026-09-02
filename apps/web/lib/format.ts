import type { PricingModel } from './types';
const labels: Record<PricingModel, string> = {
  FIXED: 'fixed price',
  PER_PERSON: 'per person',
  PER_NIGHT: 'per night',
  PER_HOUR: 'per hour',
  PER_DAY: 'per day',
  STARTING_FROM: 'starting from',
  FREE: 'Free',
  CONTACT_FOR_PRICE: 'Contact for price',
};
export function formatPricing(
  model?: PricingModel,
  price?: string | number | null,
  currency?: string | null,
): string {
  if (!model) return 'Pricing available on request';
  if (model === 'FREE') return 'Free';
  if (model === 'CONTACT_FOR_PRICE') return 'Contact for price';
  if (price === null || price === undefined || !currency) return labels[model];
  const amount = Number(price).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
  return `${currency} ${amount} ${labels[model]}`;
}
export function categoryName(
  category?: { name?: string; code?: string } | null,
): string | undefined {
  return category?.name ?? category?.code;
}
