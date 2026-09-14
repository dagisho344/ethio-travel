'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  AdminPage,
  AdminReview,
  ModerationSummary,
  adminFetch,
  statusClass,
} from '../../../lib/admin';

export function AdminModerationClient() {
  const [summary, setSummary] = useState<ModerationSummary | null>(null);
  const [reviews, setReviews] = useState<AdminPage<AdminReview> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void Promise.all([
      adminFetch<ModerationSummary>('/api/admin/moderation'),
      adminFetch<AdminPage<AdminReview>>(
        '/api/admin/reviews?limit=20&status=PENDING',
      ),
    ])
      .then(([nextSummary, nextReviews]) => {
        setSummary(nextSummary);
        setReviews(nextReviews);
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : 'Moderation data is unavailable.',
        ),
      );
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
          Trust and safety
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Moderation</h1>
        <p className="mt-2 text-slate-600">
          Review content and report queues use real lifecycle states and
          auditable actions.
        </p>
      </header>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Open reports</p>
          <p className="mt-2 text-2xl font-bold">
            {summary?.reports.open ?? '—'}
          </p>
          <Link
            href="/admin/reports?status=OPEN"
            className="mt-3 inline-block text-sm font-semibold text-emerald-800"
          >
            View reports →
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Reports under review</p>
          <p className="mt-2 text-2xl font-bold">
            {summary?.reports.underReview ?? '—'}
          </p>
          <Link
            href="/admin/reports?status=UNDER_REVIEW"
            className="mt-3 inline-block text-sm font-semibold text-emerald-800"
          >
            View reports →
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Pending reviews</p>
          <p className="mt-2 text-2xl font-bold">
            {summary?.reviews.pending ?? '—'}
          </p>
          <a
            href="#review-queue"
            className="mt-3 inline-block text-sm font-semibold text-emerald-800"
          >
            Review queue ↓
          </a>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Hidden reviews</p>
          <p className="mt-2 text-2xl font-bold">
            {summary?.reviews.hidden ?? '—'}
          </p>
          <Link
            href="/admin/audit"
            className="mt-3 inline-block text-sm font-semibold text-emerald-800"
          >
            Audit history →
          </Link>
        </div>
      </div>
      <section
        id="review-queue"
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-950">
            Pending review queue
          </h2>
          <span className="text-sm text-slate-500">
            {reviews?.meta.total ?? '—'} total
          </span>
        </div>
        <div className="mt-4 divide-y divide-slate-100">
          {reviews?.data.map((review) => (
            <div
              key={review.id}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div>
                <p className="font-semibold text-slate-950">
                  {review.target.name} · {review.rating}/5
                </p>
                <p className="text-sm text-slate-600">
                  {review.author.displayName} —{' '}
                  {review.title ?? review.body ?? 'No written text'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded px-2 py-1 text-xs font-semibold ${statusClass(review.status)}`}
                >
                  {review.status}
                </span>
                <Link
                  href={`/admin/moderation/reviews/${review.id}`}
                  className="text-sm font-semibold text-emerald-800"
                >
                  Review →
                </Link>
              </div>
            </div>
          ))}
        </div>
        {reviews && !reviews.data.length ? (
          <p className="py-6 text-center text-slate-500">
            No reviews need moderation.
          </p>
        ) : null}
      </section>
    </div>
  );
}
