'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminNoteActionDialog } from '../../../../../components/admin/AdminNoteActionDialog';
import {
  AdminReview,
  adminFetch,
  formatDate,
  statusClass,
} from '../../../../../lib/admin';

export function AdminReviewDetailClient({ reviewId }: { reviewId: string }) {
  const t = useTranslations('adminPortal');
  const [review, setReview] = useState<AdminReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const load = useCallback(() => {
    void adminFetch<AdminReview>(`/api/admin/reviews/${reviewId}`)
      .then(setReview)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : t('moderationUnavailable'),
        ),
      );
  }, [reviewId]);
  useEffect(load, [load]);
  async function publish() {
    setPublishing(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/reviews/${reviewId}/publish`, {
        method: 'POST',
      });
      load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t('reviewPublishError'),
      );
    } finally {
      setPublishing(false);
    }
  }
  if (!review) return <p className="text-slate-600">{t('loadingReview')}</p>;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
          {t('moderation')}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">
          {t('reviewDetail')}
        </h1>
      </header>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {error}
        </p>
      ) : null}
      <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-slate-950">{review.target.name}</p>
            <p className="text-sm text-slate-600">
              {t('byAuthor', { name: review.author.displayName })} ·{' '}
              {formatDate(review.createdAt)}
            </p>
          </div>
          <span
            className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass(review.status)}`}
          >
            {review.status}
          </span>
        </div>
        <p className="text-lg font-semibold text-slate-950">
          {review.rating}/5 {review.title ? `· ${review.title}` : ''}
        </p>
        <p className="whitespace-pre-wrap text-slate-700">
          {review.body ?? t('noWrittenReview')}
        </p>
        {review.businessResponse ? (
          <section className="rounded-lg bg-slate-50 p-4">
            <h2 className="font-semibold text-slate-950">
              {t('businessResponse')}
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              {review.businessResponse.body}
            </p>
          </section>
        ) : null}
        {review.moderationNote ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
            {t('latestModerationNote')} {review.moderationNote}
          </p>
        ) : null}
      </article>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">
          {t('moderationAction')}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {t('reviewImmutableNotice')}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {review.status === 'PENDING' ? (
            <>
              <button
                type="button"
                disabled={publishing}
                onClick={() => {
                  void publish();
                }}
                className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {publishing ? t('publishing') : t('publish')}
              </button>
              <AdminNoteActionDialog
                action={t('reject')}
                endpoint={`/api/admin/reviews/${review.id}/reject`}
                field="moderationNote"
                target={t('thisReview')}
                onComplete={load}
              />
            </>
          ) : null}
          {review.status === 'PUBLISHED' ? (
            <AdminNoteActionDialog
              action={t('hide')}
              endpoint={`/api/admin/reviews/${review.id}/hide`}
              field="moderationNote"
              target={t('thisReview')}
              onComplete={load}
            />
          ) : null}
          {review.status === 'HIDDEN' ? (
            <AdminNoteActionDialog
              action={t('restore')}
              endpoint={`/api/admin/reviews/${review.id}/restore`}
              field="moderationNote"
              target={t('thisReview')}
              onComplete={load}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
