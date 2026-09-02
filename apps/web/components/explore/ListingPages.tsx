import { Search } from 'lucide-react';
import {
  DestinationCard,
  BusinessCard,
  ServiceCard,
} from '../../components/cards/TravelCards';
import { Container } from '../../components/ui/Container';
import { EmptyState, SectionHeading } from '../../components/ui/States';
import { safePage } from '../../lib/api';
import type { Business, Destination, Service } from '../../lib/types';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}
function pick(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function DestinationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = pick(params.q);
  const page = pick(params.page) ?? '1';
  const response = await safePage<Destination>('/destinations', { q, page });
  return (
    <main className="bg-slate-50">
      <Container className="py-10">
        <SectionHeading
          eyebrow="Destinations"
          title="Explore Destinations"
          description="Published places across active Ethiopian cities and regions."
        />
        <form className="mb-6 flex max-w-lg gap-2">
          <input
            name="q"
            defaultValue={q}
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Search destinations"
          />
          <button className="rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white">
            <Search className="inline h-4 w-4" /> Search
          </button>
        </form>
        {response?.data.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {response.data.map((item) => (
              <DestinationCard key={item.id} destination={item} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No destinations found"
            message="Try another search or check that the API is running."
          />
        )}
      </Container>
    </main>
  );
}
export async function BusinessesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = pick(params.q);
  const category = pick(params.category);
  const response = await safePage<Business>('/businesses', {
    q,
    category,
    page: pick(params.page) ?? '1',
  });
  return (
    <main className="bg-slate-50">
      <Container className="py-10">
        <SectionHeading
          eyebrow="Businesses"
          title="Verified Businesses"
          description="Public businesses that passed platform verification."
        />
        <form className="mb-6 grid gap-2 md:grid-cols-[1fr_180px_auto]">
          <input
            name="q"
            defaultValue={q}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Search businesses"
          />
          <input
            name="category"
            defaultValue={category}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="HOTEL"
          />
          <button className="rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white">
            Search
          </button>
        </form>
        {response?.data.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {response.data.map((item) => (
              <BusinessCard key={item.id} business={item} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No businesses found"
            message="Verified businesses will appear here after approval."
          />
        )}
      </Container>
    </main>
  );
}
export async function ServicesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = pick(params.q);
  const category = pick(params.category);
  const pricingModel = pick(params.pricingModel);
  const response = await safePage<Service>('/services', {
    q,
    category,
    pricingModel,
    minPrice: pick(params.minPrice),
    maxPrice: pick(params.maxPrice),
    page: pick(params.page) ?? '1',
  });
  return (
    <main className="bg-slate-50">
      <Container className="py-10">
        <SectionHeading
          eyebrow="Services"
          title="Published Services"
          description="Experiences, stays, meals and activities from verified businesses."
        />
        <form className="mb-6 grid gap-2 md:grid-cols-5">
          <input
            name="q"
            defaultValue={q}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            placeholder="Search services"
          />
          <input
            name="category"
            defaultValue={category}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="ROOM"
          />
          <select
            name="pricingModel"
            defaultValue={pricingModel}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Any price</option>
            <option value="FREE">Free</option>
            <option value="CONTACT_FOR_PRICE">Contact</option>
            <option value="FIXED">Fixed</option>
            <option value="PER_PERSON">Per person</option>
          </select>
          <button className="rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white">
            Search
          </button>
        </form>
        {response?.data.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {response.data.map((item) => (
              <ServiceCard key={item.id} service={item} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No services found"
            message="Published services from verified businesses will appear here."
          />
        )}
      </Container>
    </main>
  );
}
