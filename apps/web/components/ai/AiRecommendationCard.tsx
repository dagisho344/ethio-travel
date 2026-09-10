import Link from 'next/link';
import type { AiRecommendation } from '../../lib/types';

export function AiRecommendationCard({
  recommendation,
  onAccept,
  onIgnore,
  busy = false,
}: {
  recommendation: AiRecommendation;
  onAccept?: () => void;
  onIgnore?: () => void;
  busy?: boolean;
}) {
  const query = new URLSearchParams({ q: recommendation.name }).toString();
  return (
    <article className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 text-sm shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-highland">
        AI suggestion ? {recommendation.entityType.toLowerCase()}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold text-slate-950">{recommendation.name}</h3>
        {recommendation.suggestedDay ? (
          <span className="text-xs font-semibold text-slate-600">
            Suggested for day {recommendation.suggestedDay}
          </span>
        ) : null}
      </div>
      {recommendation.category || recommendation.location ? (
        <p className="mt-1 text-xs text-slate-600">
          {[recommendation.category, recommendation.location]
            .filter(Boolean)
            .join(' ? ')}
        </p>
      ) : null}
      <p className="mt-3 leading-6 text-slate-700">{recommendation.reason}</p>
      {recommendation.notes ? (
        <p className="mt-2 whitespace-pre-wrap text-slate-600">
          {recommendation.notes}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-slate-600">
        {recommendation.knownPrice
          ? `Known listed price: ${recommendation.knownPrice.amount} ${recommendation.knownPrice.currency}`
          : 'Price is not known from the public listing.'}
        {' Availability is not guaranteed.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={`/explore?${query}`}
          className="font-semibold text-highland hover:text-highland/80 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          View real listing
        </Link>
        {onAccept && recommendation.id ? (
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="rounded-md bg-highland px-3 py-1.5 font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            Accept
          </button>
        ) : null}
        {onIgnore && recommendation.id ? (
          <button
            type="button"
            disabled={busy}
            onClick={onIgnore}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Ignore
          </button>
        ) : null}
      </div>
    </article>
  );
}
