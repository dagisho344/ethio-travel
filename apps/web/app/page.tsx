import Link from 'next/link';
import {
  BedDouble,
  Bus,
  Compass,
  Map,
  MapPin,
  Mountain,
  Plane,
  Search,
  Sparkles,
  Store,
  Utensils,
} from 'lucide-react';
import {
  BusinessCard,
  DestinationCard,
  ServiceCard,
} from '../components/cards/TravelCards';
import { Container } from '../components/ui/Container';
import { SectionHeading } from '../components/ui/States';
import { safePage } from '../lib/api';
import type { Business, Destination, Service } from '../lib/types';

const shortcuts = [
  {
    label: 'Hotels',
    href: '/explore?types=business,service&businessCategory=HOTEL',
    icon: BedDouble,
  },
  {
    label: 'Restaurants',
    href: '/explore?types=business,service&businessCategory=RESTAURANT',
    icon: Utensils,
  },
  { label: 'Attractions', href: '/explore?types=attraction', icon: MapPin },
  {
    label: 'Tours',
    href: '/explore?types=business,service&businessCategory=TOUR_OPERATOR',
    icon: Compass,
  },
  {
    label: 'Transport',
    href: '/explore?types=business,service&businessCategory=TRANSPORT',
    icon: Bus,
  },
];

function HomepageEmptyState({
  title,
  message,
  icon: Icon,
}: {
  title: string;
  message: string;
  icon: typeof Compass;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 text-highland">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mt-4 font-semibold text-slate-900">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        {message}
      </p>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-lg overflow-hidden rounded-lg border border-white/80 bg-white/75 p-5 shadow-xl backdrop-blur">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-100/70" />
      <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-emerald-100/80" />
      <div className="relative rounded-lg border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-highland">
              Ethiopia routes
            </p>
            <p className="mt-1 text-lg font-bold text-slate-950">
              Plan by place, service and map
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-highland text-white">
            <Plane className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-white p-4 shadow-sm">
          <div className="relative h-48 overflow-hidden rounded-md bg-[linear-gradient(135deg,#f8fafc,#ecfeff_42%,#fff7ed)]">
            <div className="absolute left-8 top-8 h-24 w-24 rounded-full border border-dashed border-highland/40" />
            <div className="absolute bottom-7 right-8 h-20 w-28 rounded-[45%] border border-dashed border-emerald-500/40" />
            <div className="absolute left-1/2 top-8 h-32 w-px -rotate-45 bg-slate-300" />
            <div className="absolute bottom-10 left-10 flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
              <MapPin
                className="h-3.5 w-3.5 text-highland"
                aria-hidden="true"
              />
              Addis Ababa
            </div>
            <div className="absolute right-8 top-10 flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
              <Mountain
                className="h-3.5 w-3.5 text-emerald-700"
                aria-hidden="true"
              />
              Highlands
            </div>
            <div className="absolute bottom-8 right-12 flex h-10 w-10 items-center justify-center rounded-full bg-highland text-white shadow-md">
              <Compass className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {['Cities', 'Stays', 'Tours'].map((item) => (
            <div
              key={item}
              className="rounded-md border border-slate-200 bg-white px-3 py-3 text-center text-xs font-semibold text-slate-600"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const [destinations, businesses, services] = await Promise.all([
    safePage<Destination>('/destinations', { limit: 3 }),
    safePage<Business>('/businesses', { limit: 3 }),
    safePage<Service>('/services', { limit: 3 }),
  ]);
  return (
    <main>
      <section className="bg-[radial-gradient(circle_at_top_left,#d9f99d,transparent_32%),linear-gradient(135deg,#ecfeff,#f8fafc_58%,#fff7ed)]">
        <Container className="grid min-h-[560px] items-center gap-10 py-12 sm:py-14 lg:grid-cols-[1.02fr_0.98fr] lg:py-16">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-highland">
              Travel Ethiopia with confidence
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Discover Ethiopia
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-700 sm:text-lg sm:leading-8">
              Explore destinations, verified local businesses, stays, food,
              experiences and attractions across Ethiopia.
            </p>
            <form
              action="/explore"
              className="mt-7 flex max-w-2xl flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/70 sm:flex-row"
            >
              <label className="sr-only" htmlFor="q">
                Where do you want to go?
              </label>
              <input
                id="q"
                name="q"
                className="min-h-11 min-w-0 flex-1 rounded-md px-3 text-base outline-none focus:ring-2 focus:ring-highland/20"
                placeholder="Where do you want to go?"
              />
              <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-highland px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2">
                <Search className="h-4 w-4" aria-hidden="true" /> Search
              </button>
            </form>
            <p className="mt-3 text-sm text-slate-500">
              Try Wolaita Sodo, hotels, food, or tours.
            </p>
          </div>
          <HeroVisual />
        </Container>
      </section>

      <Container className="py-12">
        <SectionHeading
          title="Start Exploring"
          description="Quick paths into destinations, businesses, attractions and services."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {shortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className="group flex min-h-28 flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 font-semibold text-slate-800 shadow-sm hover:-translate-y-0.5 hover:border-highland hover:text-highland hover:shadow-md focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-highland group-hover:bg-highland group-hover:text-white">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </Container>

      <Container className="py-9">
        <SectionHeading title="Popular Destinations" eyebrow="Explore" />
        {destinations?.data.length ? (
          <div className="grid gap-5 md:grid-cols-3">
            {destinations.data.map((item) => (
              <DestinationCard key={item.id} destination={item} />
            ))}
          </div>
        ) : (
          <HomepageEmptyState
            icon={MapPin}
            title="No destinations available yet"
            message="New destinations will appear here as they become available."
          />
        )}
      </Container>

      <Container className="py-9">
        <SectionHeading title="Verified Businesses" eyebrow="Marketplace" />
        {businesses?.data.length ? (
          <div className="grid gap-5 md:grid-cols-3">
            {businesses.data.map((item) => (
              <BusinessCard key={item.id} business={item} />
            ))}
          </div>
        ) : (
          <HomepageEmptyState
            icon={Store}
            title="No businesses available yet"
            message="Verified local businesses will appear here as they become available."
          />
        )}
      </Container>

      <Container className="py-9">
        <SectionHeading title="Experiences and Services" eyebrow="Book Later" />
        {services?.data.length ? (
          <div className="grid gap-5 md:grid-cols-3">
            {services.data.map((item) => (
              <ServiceCard key={item.id} service={item} />
            ))}
          </div>
        ) : (
          <HomepageEmptyState
            icon={Sparkles}
            title="No services available yet"
            message="New experiences and services will appear here as they become available."
          />
        )}
      </Container>

      <section className="bg-slate-950 text-white">
        <Container className="py-12">
          <div className="flex flex-col gap-6 rounded-lg border border-white/10 bg-white/5 p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div className="flex items-start gap-4">
              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-md bg-white/10 text-white sm:flex">
                <Map className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-2xl font-bold sm:text-3xl">
                  Explore Ethiopia on the map
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                  Switch to map view to browse public places by location.
                </p>
              </div>
            </div>
            <Link
              href="/explore?view=map"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Open Map
            </Link>
          </div>
        </Container>
      </section>
    </main>
  );
}
