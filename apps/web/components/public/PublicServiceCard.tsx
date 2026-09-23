import Link from 'next/link';
import { ArrowRight, MapPin, ShieldCheck } from 'lucide-react';
import { BookingWidget } from '../bookings/BookingWidget';
import { FavoriteButton } from '../favorites/FavoriteButton';
import { StartConversationButton } from '../messaging/StartConversationButton';
import { AddToTripButton } from '../trips/AddToTripButton';
import { PublicBusinessCardImage } from './PublicBusinessMedia';
import { publicBusinessPath } from '../../lib/public-business-route';
import { getPublicServiceCategoryPresentation } from '../../lib/public-service-category';
import type { PricingModel, Service } from '../../lib/types';

function pricingText(
  pricingModel: PricingModel,
  price: Service['price'],
  currency: string | null | undefined,
): string {
  if (pricingModel === 'FREE') return 'Free';
  if (pricingModel === 'CONTACT_FOR_PRICE') return 'Contact for price';
  if (price === null || price === undefined || !currency)
    return 'Pricing available on request';
  return `${currency} ${price}`;
}

export function PublicServiceCard({ service }: { service: Service }) {
  const categoryPresentation = getPublicServiceCategoryPresentation(
    service.category?.family,
  );
  const location = [service.city?.name, service.region?.name]
    .filter(Boolean)
    .join(', ');
  const media = service.business?.media?.[0];
  const businessHref = service.business
    ? publicBusinessPath({
        slug: service.business.slug,
        city: service.city,
        region: service.region,
      })
    : null;
  return (
    <article className="relative flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-highland/30 hover:shadow-md">
      <FavoriteButton
        targetType="SERVICE"
        targetId={service.id}
        targetName={service.name}
        className="absolute right-4 top-4"
      />
      <div className="flex flex-wrap items-center gap-2 pr-10">
        <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
          <ShieldCheck className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          Verified listing
        </span>
        {service.category?.name ? (
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
            {service.category.name}
          </span>
        ) : null}
      </div>
      {media ? (
        <div className="mt-4">
          <PublicBusinessCardImage
            businessName={service.business?.name ?? 'EthioTravel business'}
            hero={media}
            logo={null}
          />
        </div>
      ) : null}
      <h2 className="mt-4 text-lg font-bold text-slate-950">{service.name}</h2>
      {businessHref && service.business?.name ? (
        <Link
          href={businessHref}
          className="mt-1 w-fit text-sm font-semibold text-slate-700 hover:text-highland focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
        >
          {service.business.name}
        </Link>
      ) : service.business?.name ? (
        <p className="mt-1 text-sm font-semibold text-slate-700">
          {service.business.name}
        </p>
      ) : null}
      {location ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          {location}
        </p>
      ) : null}
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
        {service.shortDescription}
      </p>
      <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <p className="font-semibold text-slate-950">
          {pricingText(service.pricingModel, service.price, service.currency)}
        </p>
        {categoryPresentation ? (
          <Link
            href={categoryPresentation.href}
            className="mt-1 inline-block text-xs font-semibold text-highland hover:text-highland/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
          >
            Browse {categoryPresentation.label}
          </Link>
        ) : null}
      </div>
      <BookingWidget
        serviceId={service.id}
        serviceName={service.name}
        pricingModel={service.pricingModel}
        price={service.price}
        currency={service.currency}
        compact
      />
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link
          href={`/services/${service.id}`}
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
        >
          View service details{' '}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
