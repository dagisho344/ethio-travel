import Link from 'next/link';
import { Briefcase, Landmark, MapPin, Sparkles } from 'lucide-react';
import { BookingWidget } from '../bookings/BookingWidget';
import { FavoriteButton } from '../favorites/FavoriteButton';
import { StartConversationButton } from '../messaging/StartConversationButton';
import { PublicBusinessCardImage } from '../public/PublicBusinessMedia';
import { ReviewForm } from '../reviews/ReviewForm';
import { ReviewPanel } from '../reviews/ReviewPanel';
import { AddToTripButton } from '../trips/AddToTripButton';
import {
  favoriteLookupKey,
  type FavoriteLookup,
} from '../../lib/favorite-utils';
import { categoryName, formatPricing } from '../../lib/format';
import { publicBusinessPath } from '../../lib/public-business-route';
import { publicDestinationPath } from '../../lib/public-destination-route';
import type {
  Business,
  Destination,
  FavoriteTargetType,
  MyReview,
  SearchResult,
  Service,
} from '../../lib/types';

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex h-32 items-end rounded-md bg-gradient-to-br from-emerald-100 via-sky-100 to-amber-100 p-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
      {label}
    </div>
  );
}
function LocationLine({
  city,
  region,
}: {
  city?: { name: string };
  region?: { name: string };
}) {
  return (
    <p className="mt-2 flex items-center gap-1 text-sm text-slate-500">
      <MapPin className="h-4 w-4" aria-hidden="true" />
      {[city?.name, region?.name].filter(Boolean).join(', ') || 'Ethiopia'}
    </p>
  );
}

export function DestinationCard({ destination }: { destination: Destination }) {
  const destinationHref = publicDestinationPath(destination);
  return (
    <article className="relative rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <FavoriteButton
        targetType="DESTINATION"
        targetId={destination.id}
        targetName={destination.name}
        className="absolute right-4 top-4 z-10"
      />
      <Placeholder label="Destination" />
      <div className="p-2">
        <h3 className="text-lg font-bold text-slate-950">{destination.name}</h3>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
          {destination.shortDescription}
        </p>
        <LocationLine city={destination.city} region={destination.region} />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {destinationHref ? (
            <Link
              href={destinationHref}
              className="inline-flex text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
            >
              View destination
            </Link>
          ) : null}
          <AddToTripButton
            targetType="DESTINATION"
            targetId={destination.id}
            targetName={destination.name}
          />
        </div>
      </div>
    </article>
  );
}
export function BusinessCard({ business }: { business: Business }) {
  const businessHref = publicBusinessPath(business);

  return (
    <article className="relative rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <FavoriteButton
        targetType="BUSINESS"
        targetId={business.id}
        targetName={business.name}
        className="absolute right-4 top-4 z-10"
      />
      <PublicBusinessCardImage
        businessName={business.name}
        hero={business.media?.hero}
        logo={business.media?.logo}
      />
      <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
        <Briefcase className="h-3.5 w-3.5" />
        {categoryName(business.category) ?? 'Verified Business'}
      </div>
      <h3 className="text-lg font-bold text-slate-950">{business.name}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
        {business.description}
      </p>
      <LocationLine city={business.city} region={business.region} />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {businessHref ? (
          <Link
            href={businessHref}
            className="inline-flex text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
          >
            View business
          </Link>
        ) : null}
        <AddToTripButton
          targetType="BUSINESS"
          targetId={business.id}
          targetName={business.name}
        />
        <StartConversationButton
          businessId={business.id}
          label="Message business"
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-highland px-3 py-2 text-sm font-semibold text-highland hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
    </article>
  );
}
export function ServiceCard({ service }: { service: Service }) {
  return (
    <article className="relative rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <FavoriteButton
        targetType="SERVICE"
        targetId={service.id}
        targetName={service.name}
        className="absolute right-4 top-4 z-10"
      />
      <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">
        <Sparkles className="h-3.5 w-3.5" />
        {categoryName(service.category) ?? 'Service'}
      </div>
      <h3 className="text-lg font-bold text-slate-950">{service.name}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
        {service.shortDescription}
      </p>
      <p className="mt-3 font-semibold text-slate-900">
        {formatPricing(service.pricingModel, service.price, service.currency)}
      </p>
      <p className="mt-2 text-sm text-slate-500">{service.business?.name}</p>
      <BookingWidget
        serviceId={service.id}
        serviceName={service.name}
        pricingModel={service.pricingModel}
        price={service.price}
        currency={service.currency}
        compact
      />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/services/${service.id}`}
          className="inline-flex text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
        >
          View service details
        </Link>
        <AddToTripButton
          targetType="SERVICE"
          targetId={service.id}
          targetName={service.name}
        />
        {service.business?.id ? (
          <StartConversationButton
            businessId={service.business.id}
            label="Message business"
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-highland px-3 py-2 text-sm font-semibold text-highland hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          />
        ) : null}
      </div>
    </article>
  );
}
export function SearchResultCard({
  result,
  favoriteLookup = {},
  reviewLookup = {},
  onShowOnMap,
}: {
  result: SearchResult;
  favoriteLookup?: FavoriteLookup;
  reviewLookup?: Record<string, MyReview>;
  onShowOnMap?: () => void;
}) {
  const typeLabel =
    result.type === 'business'
      ? 'Verified Business'
      : result.type.charAt(0).toUpperCase() + result.type.slice(1);
  const targetType = result.type.toUpperCase() as FavoriteTargetType;
  const destinationHref =
    result.type === 'destination'
      ? publicDestinationPath({
          slug: result.slug,
          city: result.location.city,
          region: result.location.region,
        })
      : null;

  const businessHref =
    result.type === 'business'
      ? publicBusinessPath({
          slug: result.slug,
          city: result.location.city,
          region: result.location.region,
        })
      : null;

  return (
    <article className="relative rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <FavoriteButton
        targetType={targetType}
        targetId={result.id}
        targetName={result.name}
        initialFavoriteId={
          favoriteLookup[favoriteLookupKey(targetType, result.id)]
        }
        className="absolute right-3 top-3 z-10"
      />
      <div className="flex items-center justify-between gap-3 pr-11">
        <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
          <Landmark className="h-3.5 w-3.5" />
          {typeLabel}
        </span>
        {result.pricingModel ? (
          <span className="text-sm font-semibold text-highland">
            {formatPricing(result.pricingModel, result.price, result.currency)}
          </span>
        ) : null}
      </div>
      <h3 className="mt-3 text-lg font-bold text-slate-950">{result.name}</h3>
      {result.shortDescription ? (
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
          {result.shortDescription}
        </p>
      ) : null}
      <LocationLine
        city={result.location.city}
        region={result.location.region}
      />
      {result.type === 'service' ? (
        <BookingWidget
          serviceId={result.id}
          serviceName={result.name}
          pricingModel={result.pricingModel}
          price={result.price}
          currency={result.currency}
          compact
        />
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <AddToTripButton
          targetType={targetType}
          targetId={result.id}
          targetName={result.name}
        />
        {result.type === 'business' ? (
          <StartConversationButton
            businessId={result.id}
            label="Message business"
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-highland px-3 py-2 text-sm font-semibold text-highland hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          />
        ) : null}
      </div>
      {onShowOnMap && result.latitude != null && result.longitude != null ? (
        <button
          type="button"
          onClick={onShowOnMap}
          className="mt-4 text-sm font-semibold text-highland hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland"
        >
          Show on map
        </button>
      ) : null}
      <div className="mt-5 space-y-4">
        <ReviewForm
          targetType={targetType}
          targetId={result.id}
          targetName={result.name}
          existingReview={reviewLookup[`${targetType}:${result.id}`]}
        />
        <ReviewPanel targetType={targetType} targetId={result.id} />
      </div>
      {businessHref ? (
        <Link
          className="mt-4 inline-block text-sm font-semibold text-highland"
          href={businessHref}
        >
          View business
        </Link>
      ) : null}
      {result.type === 'service' ? (
        <Link
          className="mt-4 inline-block text-sm font-semibold text-highland"
          href={`/services/${result.id}`}
        >
          View service details
        </Link>
      ) : null}
      {destinationHref ? (
        <Link
          className="mt-4 inline-block text-sm font-semibold text-highland"
          href={destinationHref}
        >
          View destination
        </Link>
      ) : null}
    </article>
  );
}
