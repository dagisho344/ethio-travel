'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Edit3, MapPin, Star } from 'lucide-react';
import type {
  MyReview,
  PaginatedResponse,
  ReviewStatus,
  ReviewTargetType,
} from '../../lib/types';

const statusOptions: Array<{ value: ReviewStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'HIDDEN', label: 'Hidden' },
  { value: 'REJECTED', label: 'Rejected' },
];
const targetOptions: Array<{ value: ReviewTargetType | ''; label: string }> = [
  { value: '', label: 'All reviewed items' },
  { value: 'DESTINATION', label: 'Destinations' },
  { value: 'ATTRACTION', label: 'Attractions' },
  { value: 'BUSINESS', label: 'Businesses' },
  { value: 'SERVICE', label: 'Services' },
];

function targetPath(review: MyReview) {
  const target = review.target;
  const regionSlug = target.region?.slug ?? '';
  const citySlug = target.city?.slug ?? '';
  if (target.type === 'DESTINATION') {
    return `/explore?types=destination&regionSlug=${regionSlug}&citySlug=${citySlug}&destinationSlug=${target.slug}`;
  }
  if (target.type === 'ATTRACTION') {
    return `/explore?types=attraction&regionSlug=${regionSlug}&citySlug=${citySlug}&destinationSlug=${target.destination?.slug ?? ''}&q=${encodeURIComponent(target.name)}`;
  }
  if (target.type === 'BUSINESS') {
    return `/explore?types=business&regionSlug=${regionSlug}&citySlug=${citySlug}&q=${encodeURIComponent(target.name)}`;
  }
  return `/explore?types=service&regionSlug=${regionSlug}&citySlug=${citySlug}&q=${encodeURIComponent(target.name)}`;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex text-amber-500"
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={`h-4 w-4 ${rating >= value ? 'fill-current' : ''}`}
        />
      ))}
    </span>
  );
}

export function ReviewsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [page, setPage] = useState<PaginatedResponse<MyReview> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const status = searchParams.get('status') as ReviewStatus | null;
  const targetType = searchParams.get('targetType') as ReviewTargetType | null;
  const currentPage = searchParams.get('page') ?? '1';

  const query = useMemo(() => {
    const params = new URLSearchParams({
      mine: 'true',
      page: currentPage,
      limit: '9',
    });
    if (status) params.set('status', status);
    if (targetType) params.set('targetType', targetType);
    return params.toString();
  }, [currentPage, status, targetType]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/reviews?${query}`, {
          cache: 'no-store',
        });
        if (response.status === 401) {
          router.replace(`/login?returnTo=${encodeURIComponent('/reviews')}`);
          return;
        }
        if (!response.ok) throw new Error('Request failed');
        setPage((await response.json()) as PaginatedResponse<MyReview>);
      } catch {
        setPage(null);
        setError('We could not load your reviews right now.');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [query, router]);

  function update(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    const url = params.toString() ? `${pathname}?${params}` : pathname;
    router.push(url);
  }

  return (
    <div>
      <div className="mb-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          Type
          <select
            value={targetType ?? ''}
            onChange={(event) =>
              update({ targetType: event.target.value || null, page: null })
            }
            className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-highland focus:outline-none focus:ring-2 focus:ring-highland/20"
          >
            {targetOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Status
          <select
            value={status ?? ''}
            onChange={(event) =>
              update({ status: event.target.value || null, page: null })
            }
            className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-highland focus:outline-none focus:ring-2 focus:ring-highland/20"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading reviews...
        </div>
      ) : null}
      {!loading && page?.data.length ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {page.data.map((review) => (
            <article
              key={review.id}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                  {review.status}
                </span>
                <Stars rating={review.rating} />
              </div>
              <h2 className="mt-3 text-lg font-bold text-slate-950">
                {review.target.name}
              </h2>
              <p className="mt-2 flex items-center gap-1 text-sm text-slate-500">
                <MapPin className="h-4 w-4" />
                {[review.target.city?.name, review.target.region?.name]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              {review.title ? (
                <p className="mt-3 font-semibold text-slate-900">
                  {review.title}
                </p>
              ) : null}
              {review.body ? (
                <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600">
                  {review.body}
                </p>
              ) : null}
              {review.moderationNote ? (
                <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Moderation note: {review.moderationNote}
                </p>
              ) : null}
              <Link
                href={targetPath(review)}
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
              >
                <Edit3 className="h-4 w-4" />
                Edit on target
              </Link>
            </article>
          ))}
        </div>
      ) : null}
      {!loading && page && page.data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
          <Star className="mx-auto h-8 w-8 text-highland" />
          <h2 className="mt-4 text-base font-semibold text-slate-950">
            No reviews yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
            Reviews you write for destinations, attractions, businesses and
            services will appear here.
          </p>
          <Link
            href="/explore"
            className="mt-5 inline-flex rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Start exploring
          </Link>
        </div>
      ) : null}
      {page && page.meta.totalPages > 1 ? (
        <div className="mt-6 flex justify-center gap-2">
          <button
            disabled={page.meta.page <= 1}
            onClick={() => update({ page: String(page.meta.page - 1) })}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Previous
          </button>
          <button
            disabled={page.meta.page >= page.meta.totalPages}
            onClick={() => update({ page: String(page.meta.page + 1) })}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
