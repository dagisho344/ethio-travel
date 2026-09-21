import Link from 'next/link';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { safePage } from '../../lib/api';
import {
  getPublicServiceCategoryPresentation,
  type PublicServiceCategoryFamily,
} from '../../lib/public-service-category';
import type { Service } from '../../lib/types';
import { PublicServiceCard } from './PublicServiceCard';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/States';

function pageNumber(value: string | string[] | undefined): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = Number(candidate);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function categoryHref(path: string, page: number): string {
  return page <= 1 ? path : `${path}?page=${page}`;
}

export async function CategoryMarketplacePage({
  family,
  searchParams,
}: {
  family: Exclude<PublicServiceCategoryFamily, 'OTHER'>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const presentation = getPublicServiceCategoryPresentation(family);
  if (!presentation) return null;
  const page = pageNumber((await searchParams).page);
  const response = await safePage<Service>('/services', {
    family,
    limit: 12,
    page,
  });
  const services = response?.data ?? [];

  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow="EXPLORE ETHIOTRAVEL"
          title={presentation.label}
          description={presentation.description}
        />
        {!response ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-900">
            We could not load {presentation.label.toLowerCase()} right now.
            Please try again soon.
          </div>
        ) : services.length ? (
          <>
            <p className="mb-5 text-sm text-slate-600">
              {response.meta.total} result
              {response.meta.total === 1 ? '' : 's'} from verified businesses
            </p>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {services.map((service) => (
                <PublicServiceCard key={service.id} service={service} />
              ))}
            </div>
            {response.meta.totalPages > 1 ? (
              <nav
                className="mt-8 flex items-center justify-between gap-3"
                aria-label={`${presentation.label} pagination`}
              >
                {response.meta.page > 1 ? (
                  <Link
                    href={categoryHref(
                      presentation.href,
                      response.meta.page - 1,
                    )}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Previous
                  </Link>
                ) : (
                  <span />
                )}
                <p className="text-sm text-slate-600">
                  Page {response.meta.page} of {response.meta.totalPages}
                </p>
                {response.meta.page < response.meta.totalPages ? (
                  <Link
                    href={categoryHref(
                      presentation.href,
                      response.meta.page + 1,
                    )}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </>
        ) : (
          <section className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
            <Sparkles
              className="mx-auto h-8 w-8 text-highland"
              aria-hidden="true"
            />
            <h2 className="mt-4 text-lg font-semibold text-slate-950">
              No {presentation.label.toLowerCase()} available yet
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
              Verified services in this category will appear here when they are
              published.
            </p>
          </section>
        )}
      </Container>
    </main>
  );
}
