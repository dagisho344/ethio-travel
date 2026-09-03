'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Star } from 'lucide-react';
import type { MyReview, ReviewTargetType } from '../../lib/types';

type ReviewFormProps = {
  targetType: ReviewTargetType;
  targetId: string;
  targetName: string;
  existingReview?: MyReview;
  className?: string;
};

class ReviewRouteError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function readError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  if (Array.isArray(data?.message)) return data.message.join(' ');
  return data?.message ?? 'Review request failed.';
}

async function reviewRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    throw new ReviewRouteError(await readError(response), response.status);
  }
  return (await response.json()) as T;
}

function safeReturnTo(
  pathname: string,
  params: { toString(): string },
): string {
  const query = params.toString();
  const value = query ? `${pathname}?${query}` : pathname;
  return value.startsWith('/') && !value.startsWith('//') ? value : '/explore';
}

function friendlyError(error: unknown) {
  if (error instanceof ReviewRouteError) {
    if (error.status === 409)
      return 'You already reviewed this item. Update your existing review instead.';
    if (error.status === 404)
      return 'This item is not available for review right now.';
    if (error.status >= 500) return 'We could not save your review right now.';
  }
  return 'Check your rating and try again.';
}

export function ReviewForm({
  targetType,
  targetId,
  targetName,
  existingReview,
  className = '',
}: ReviewFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [review, setReview] = useState(existingReview);
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [title, setTitle] = useState(existingReview?.title ?? '');
  const [body, setBody] = useState(existingReview?.body ?? '');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loginUrl = useMemo(() => {
    const params = new URLSearchParams({
      returnTo: safeReturnTo(pathname, searchParams),
    });
    return `/login?${params.toString()}`;
  }, [pathname, searchParams]);

  async function submit() {
    if (pending) return;
    setError(null);
    setMessage(null);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setError('Choose a rating from 1 to 5 stars.');
      return;
    }
    const payload = {
      rating,
      title: title.trim() || undefined,
      body: body.trim() || undefined,
    };
    setPending(true);
    try {
      const saved = review
        ? await reviewRequest<MyReview>(`/api/reviews/${review.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await reviewRequest<MyReview>('/api/reviews', {
            method: 'POST',
            body: JSON.stringify({ targetType, targetId, ...payload }),
          });
      setReview(saved);
      setRating(saved.rating);
      setTitle(saved.title ?? '');
      setBody(saved.body ?? '');
      setMessage('Your review is pending moderation.');
      router.refresh();
    } catch (err) {
      if (err instanceof ReviewRouteError && err.status === 401) {
        router.push(loginUrl);
        return;
      }
      setError(friendlyError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-950">
            {review ? 'Update your review' : 'Write a Review'}
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Reviews are checked before they become public. Editing sends your
            review back to pending moderation.
          </p>
        </div>
        {review ? (
          <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
            {review.status}
          </span>
        ) : null}
      </div>

      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <fieldset disabled={pending}>
          <legend className="text-sm font-semibold text-slate-700">
            Rating for {targetName}
          </legend>
          <div
            className="mt-2 flex gap-1"
            role="radiogroup"
            aria-label="Rating"
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                aria-pressed={rating === value}
                className="rounded-md p-1 text-amber-500 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
              >
                <Star
                  className={`h-6 w-6 ${rating >= value ? 'fill-current' : ''}`}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm font-semibold text-slate-700">
          Title optional
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-highland focus:ring-2 focus:ring-highland/20"
            placeholder="A short headline"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Review optional
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={5000}
            rows={4}
            className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-highland focus:ring-2 focus:ring-highland/20"
            placeholder="Share what other travelers should know"
          />
        </label>

        {review?.moderationNote ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Moderation note: {review.moderationNote}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm font-medium text-red-700">{error}</p>
        ) : null}
        {message ? (
          <p className="text-sm font-medium text-emerald-700">{message}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending
            ? 'Saving review...'
            : review
              ? 'Update review'
              : 'Submit review'}
        </button>
      </form>
    </section>
  );
}
