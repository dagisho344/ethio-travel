'use client';

import { useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import type {
  PaginatedResponse,
  PublicReview,
  ReviewSummary,
  ReviewTargetType,
} from '../../lib/types';

const sortOptions = [
  ['newest', 'Newest'],
  ['oldest', 'Oldest'],
  ['highest', 'Highest rating'],
  ['lowest', 'Lowest rating'],
] as const;

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
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
    new Date(value),
  );
}

export function ReviewPanel({
  targetType,
  targetId,
}: {
  targetType: ReviewTargetType;
  targetId: string;
}) {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [page, setPage] = useState<PaginatedResponse<PublicReview> | null>(
    null,
  );
  const [rating, setRating] = useState('');
  const [sort, setSort] = useState('newest');
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      targetType,
      targetId,
      page: String(pageNumber),
      limit: '5',
      sort,
    });
    if (rating) params.set('rating', rating);
    return params.toString();
  }, [pageNumber, rating, sort, targetId, targetType]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [summaryResponse, reviewsResponse] = await Promise.all([
          fetch(
            `/api/reviews/summary?targetType=${targetType}&targetId=${targetId}`,
            {
              cache: 'no-store',
            },
          ),
          fetch(`/api/reviews?${query}`, { cache: 'no-store' }),
        ]);
        if (!summaryResponse.ok || !reviewsResponse.ok)
          throw new Error('Request failed');
        setSummary((await summaryResponse.json()) as ReviewSummary);
        setPage(
          (await reviewsResponse.json()) as PaginatedResponse<PublicReview>,
        );
      } catch {
        setSummary(null);
        setPage(null);
        setError('We could not load reviews right now.');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [query, targetId, targetType]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-950">
            Traveler reviews
          </h3>
          {summary ? (
            <p className="mt-1 text-sm text-slate-600">
              {summary.averageRating === null
                ? 'No ratings yet'
                : `${summary.averageRating.toFixed(1)} average rating`}{' '}
              from {summary.reviewCount} review
              {summary.reviewCount === 1 ? '' : 's'}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={rating}
            onChange={(event) => {
              setRating(event.target.value);
              setPageNumber(1);
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-highland focus:outline-none focus:ring-2 focus:ring-highland/20"
          >
            <option value="">Any rating</option>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value} stars
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPageNumber(1);
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-highland focus:outline-none focus:ring-2 focus:ring-highland/20"
          >
            {sortOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {summary ? (
        <div className="mt-5 grid gap-2 text-sm text-slate-600 sm:grid-cols-5">
          {[5, 4, 3, 2, 1].map((value) => (
            <div key={value} className="rounded-md bg-slate-50 px-3 py-2">
              <span className="font-semibold text-slate-950">{value}</span>{' '}
              star:{' '}
              {
                summary.ratingDistribution[
                  String(value) as '1' | '2' | '3' | '4' | '5'
                ]
              }
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="mt-5 text-sm text-slate-500">Loading reviews...</p>
      ) : page?.data.length ? (
        <div className="mt-5 space-y-4">
          {page.data.map((review) => (
            <article
              key={review.id}
              className="rounded-lg border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Stars rating={review.rating} />
                <span className="text-xs text-slate-500">
                  {formatDate(review.publishedAt ?? review.createdAt)}
                </span>
              </div>
              {review.title ? (
                <h4 className="mt-3 font-semibold text-slate-950">
                  {review.title}
                </h4>
              ) : null}
              {review.body ? (
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {review.body}
                </p>
              ) : null}
              <p className="mt-3 text-xs font-semibold text-slate-500">
                {review.author.displayName}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-md bg-slate-50 px-3 py-4 text-sm text-slate-600">
          No published reviews yet.
        </p>
      )}

      {page && page.meta.totalPages > 1 ? (
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            disabled={page.meta.page <= 1}
            onClick={() => setPageNumber((value) => Math.max(value - 1, 1))}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page.meta.page >= page.meta.totalPages}
            onClick={() => setPageNumber((value) => value + 1)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}
