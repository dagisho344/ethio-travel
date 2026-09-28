'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  canEditBusiness,
  getManagedBusiness,
} from '../../lib/business-management';
import {
  getBusinessReviews,
  operationError,
  respondToReview,
} from '../../lib/business-operations';
import type { ManagedBusinessReview } from '../../lib/business-operations';
import { resolveLocale } from '../../i18n/config';
import { formatLocaleDate } from '../../i18n/format';
export function BusinessReviewsClient({ businessId }: { businessId: string }) {
  const t = useTranslations('businessPortal');
  const locale = resolveLocale(useLocale());
  const [reviews, setReviews] = useState<ManagedBusinessReview[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [page, business] = await Promise.all([
        getBusinessReviews(businessId),
        getManagedBusiness(businessId),
      ]);
      setReviews(page.data);
      setCanWrite(canEditBusiness(business));
    } catch (reason) {
      setError(operationError(reason, t('loadReviewsError')));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [businessId, t]);
  async function save(review: ManagedBusinessReview) {
    const body = (
      drafts[review.id] ??
      review.businessResponse?.body ??
      ''
    ).trim();
    if (!body) {
      setError(t('responseRequired'));
      return;
    }
    setSaving(review.id);
    setError(null);
    try {
      await respondToReview(businessId, review.id, body);
      await load();
    } catch (reason) {
      setError(operationError(reason, t('saveResponseError')));
    } finally {
      setSaving(null);
    }
  }
  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link
          href={`/businesses/manage/${businessId}`}
          className="text-sm font-semibold text-highland"
        >
          {t('backToWorkspace')}
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-950">
          {t('reviews')}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{t('reviewsDescription')}</p>
        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            {error}
          </p>
        ) : null}
        {loading ? (
          <p className="mt-6 rounded-md bg-white p-5 text-sm text-slate-500">
            {t('loadingReviews')}
          </p>
        ) : reviews.length ? (
          <div className="mt-6 space-y-4">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">
                      {review.author.displayName} · {review.rating}/5
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase text-slate-500">
                      {review.status}
                      {review.service ? ` · ${review.service.name}` : ''}
                    </p>
                  </div>
                  <time className="text-sm text-slate-500">
                    {formatLocaleDate(review.createdAt, locale)}
                  </time>
                </div>
                {review.title ? (
                  <h2 className="mt-3 font-semibold text-slate-900">
                    {review.title}
                  </h2>
                ) : null}
                {review.body ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {review.body}
                  </p>
                ) : null}
                {review.status === 'PUBLISHED' ? (
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <p className="text-sm font-semibold text-slate-800">
                      {t('officialResponse')}
                    </p>
                    {canWrite ? (
                      <>
                        <textarea
                          value={
                            drafts[review.id] ??
                            review.businessResponse?.body ??
                            ''
                          }
                          onChange={(event) =>
                            setDrafts({
                              ...drafts,
                              [review.id]: event.target.value,
                            })
                          }
                          maxLength={2000}
                          rows={3}
                          className="mt-2 w-full rounded-md border border-slate-300 p-2.5 text-sm"
                        />
                        <button
                          disabled={saving === review.id}
                          onClick={() => void save(review)}
                          className="mt-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                        >
                          {saving === review.id
                            ? t('saving')
                            : review.businessResponse
                              ? t('updateResponse')
                              : t('publishResponse')}
                        </button>
                      </>
                    ) : review.businessResponse ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                        {review.businessResponse.body}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">
                        {t('staffReviewsReadOnly')}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    {t('publishedOnlyResponse')}
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
            {t('noReviews')}
          </p>
        )}
      </div>
    </main>
  );
}
