'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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
export function BusinessReviewsClient({ businessId }: { businessId: string }) {
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
      setError(operationError(reason, 'Reviews could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [businessId]);
  async function save(review: ManagedBusinessReview) {
    const body = (
      drafts[review.id] ??
      review.businessResponse?.body ??
      ''
    ).trim();
    if (!body) {
      setError('Write a response before saving.');
      return;
    }
    setSaving(review.id);
    setError(null);
    try {
      await respondToReview(businessId, review.id, body);
      await load();
    } catch (reason) {
      setError(
        operationError(reason, 'The business response could not be saved.'),
      );
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
          Back to workspace
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-950">Reviews</h1>
        <p className="mt-1 text-sm text-slate-600">
          Published review responses are official business replies. Ratings,
          traveler text, and moderation states cannot be changed here.
        </p>
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
            Loading reviews...
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
                    {new Date(review.createdAt).toLocaleDateString()}
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
                      Official business response
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
                            ? 'Saving...'
                            : review.businessResponse
                              ? 'Update response'
                              : 'Publish response'}
                        </button>
                      </>
                    ) : review.businessResponse ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                        {review.businessResponse.body}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">
                        Staff can view reviews but cannot publish official
                        responses.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    Only published reviews can receive a public business
                    response.
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
            No reviews for this business or its services yet.
          </p>
        )}
      </div>
    </main>
  );
}
