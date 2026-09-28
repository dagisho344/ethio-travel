'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AdminPage,
  AdminReview,
  ModerationSummary,
  adminFetch,
  statusClass,
} from '../../../lib/admin';

export function AdminModerationClient() {
  const t = useTranslations('adminPortal');
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
          cause instanceof Error ? cause.message : t('moderationUnavailable'),
        ),
      );
  }, [t]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
          {t('trustSafety')}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">
          {t('moderation')}
        </h1>
        <p className="mt-2 text-slate-600">{t('moderationDescription')}</p>
      </header>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">{t('openReports')}</p>
          <p className="mt-2 text-2xl font-bold">
            {summary?.reports.open ?? '—'}
          </p>
          <Link
            href="/admin/reports?status=OPEN"
            className="mt-3 inline-block text-sm font-semibold text-emerald-800"
          >
            {t('viewReports')} →
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">{t('reportsUnderReview')}</p>
          <p className="mt-2 text-2xl font-bold">
            {summary?.reports.underReview ?? '—'}
          </p>
          <Link
            href="/admin/reports?status=UNDER_REVIEW"
            className="mt-3 inline-block text-sm font-semibold text-emerald-800"
          >
            {t('viewReports')} →
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">{t('pendingReviews')}</p>
          <p className="mt-2 text-2xl font-bold">
            {summary?.reviews.pending ?? '—'}
          </p>
          <a
            href="#review-queue"
            className="mt-3 inline-block text-sm font-semibold text-emerald-800"
          >
            {t('reviewQueue')} ↓
          </a>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">{t('hiddenReviews')}</p>
          <p className="mt-2 text-2xl font-bold">
            {summary?.reviews.hidden ?? '—'}
          </p>
          <Link
            href="/admin/audit"
            className="mt-3 inline-block text-sm font-semibold text-emerald-800"
          >
            {t('auditHistory')} →
          </Link>
        </div>
      </div>
      <section
        id="review-queue"
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-950">
            {t('pendingReviewQueue')}
          </h2>
          <span className="text-sm text-slate-500">
            {t('total', { count: reviews?.meta.total ?? 0 })}
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
                  {review.title ?? review.body ?? t('noWrittenText')}
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
                  {t('review')} →
                </Link>
              </div>
            </div>
          ))}
        </div>
        {reviews && !reviews.data.length ? (
          <p className="py-6 text-center text-slate-500">
            {t('noReviewsModeration')}
          </p>
        ) : null}
      </section>
    </div>
  );
}
