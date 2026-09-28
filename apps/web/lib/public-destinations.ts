import type { AppLocale } from '../i18n/config';
import { getJson, safePage } from './api';
import type { Destination, PaginatedResponse } from './types';

type DestinationQuery = Record<string, string | number | undefined | null>;

/**
 * The public Destination API owns editorial translation publication and
 * fallback. Pages may only forward the already validated server locale; they
 * must never query translation records or reproduce lifecycle rules.
 */
export function publicDestinationQuery(
  locale: AppLocale,
  query: DestinationQuery = {},
): DestinationQuery {
  return { ...query, locale };
}

export function safeDestinationPage(
  path: string,
  locale: AppLocale,
  query?: DestinationQuery,
): Promise<PaginatedResponse<Destination> | null> {
  return safePage<Destination>(path, publicDestinationQuery(locale, query));
}

export function getPublicDestination(
  path: string,
  locale: AppLocale,
): Promise<Destination> {
  return getJson<Destination>(path, publicDestinationQuery(locale));
}
