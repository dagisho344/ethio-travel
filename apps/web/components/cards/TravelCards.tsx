import Link from 'next/link';
import { Briefcase, Landmark, MapPin, Sparkles } from 'lucide-react';
import { categoryName, formatPricing } from '../../lib/format';
import type {
  Business,
  Destination,
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
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <Placeholder label="Destination" />
      <div className="p-2">
        <h3 className="text-lg font-bold text-slate-950">{destination.name}</h3>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
          {destination.shortDescription}
        </p>
        <LocationLine city={destination.city} region={destination.region} />
      </div>
    </article>
  );
}
export function BusinessCard({ business }: { business: Business }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
        <Briefcase className="h-3.5 w-3.5" />
        {categoryName(business.category) ?? 'Verified Business'}
      </div>
      <h3 className="text-lg font-bold text-slate-950">{business.name}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
        {business.description}
      </p>
      <LocationLine city={business.city} region={business.region} />
    </article>
  );
}
export function ServiceCard({ service }: { service: Service }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
    </article>
  );
}
export function SearchResultCard({ result }: { result: SearchResult }) {
  const typeLabel =
    result.type === 'business'
      ? 'Verified Business'
      : result.type.charAt(0).toUpperCase() + result.type.slice(1);
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
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
      {result.type === 'destination' &&
      result.location.region &&
      result.location.city ? (
        <Link
          className="mt-4 inline-block text-sm font-semibold text-highland"
          href={`/destinations/${result.location.region.slug}/${result.location.city.slug}/${result.slug}`}
        >
          View destination
        </Link>
      ) : null}
    </article>
  );
}
