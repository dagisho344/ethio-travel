'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { generateTripAiSuggestions } from '../../lib/ai';
import { BffRequestError, bffJson } from '../../lib/private-api';
import type { AiRecommendation } from '../../lib/types';
import { AiRecommendationCard } from './AiRecommendationCard';

const actions = [
  {
    label: 'Generate itinerary',
    intent: 'TRIP_ITINERARY',
    instruction: 'Suggest a balanced itinerary using grounded candidates.',
  },
  {
    label: 'Improve itinerary',
    intent: 'TRIP_IMPROVEMENT',
    instruction:
      'Improve the itinerary while preserving existing booking context.',
  },
  {
    label: 'More cultural attractions',
    intent: 'TRIP_IMPROVEMENT',
    instruction: 'Suggest cultural attractions that fit the trip dates.',
  },
  {
    label: 'Make it less busy',
    intent: 'TRIP_IMPROVEMENT',
    instruction:
      'Suggest only a relaxed, lower-pace addition if it improves the trip.',
  },
] as const;

export function TripAiAssistant({
  tripId,
  disabled,
  onApplied,
}: {
  tripId: string;
  disabled: boolean;
  onApplied: () => Promise<void>;
}) {
  const [recommendations, setRecommendations] = useState<AiRecommendation[]>(
    [],
  );
  const [summary, setSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(intent: string, instruction: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await generateTripAiSuggestions(tripId, {
        intent,
        instruction,
      });
      setSummary(response.summary);
      setRecommendations(response.recommendations);
    } catch (cause) {
      setError(
        cause instanceof BffRequestError && cause.status === 503
          ? 'AI recommendations are temporarily unavailable. You can continue using the normal Trip Planner.'
          : 'We could not generate trip suggestions right now.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function apply(recommendation: AiRecommendation) {
    if (!recommendation.id) return;
    setBusy(true);
    setError(null);
    try {
      await bffJson(
        `/api/trips/${tripId}/ai/suggestions/${recommendation.id}/apply`,
        { method: 'POST' },
      );
      setRecommendations((current) =>
        current.filter((item) => item.id !== recommendation.id),
      );
      await onApplied();
    } catch (cause) {
      setError(
        cause instanceof BffRequestError
          ? cause.message
          : 'This suggestion could not be applied. Your itinerary was not changed.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function dismiss(recommendation: AiRecommendation) {
    if (!recommendation.id) return;
    setBusy(true);
    setError(null);
    try {
      await bffJson(
        `/api/trips/${tripId}/ai/suggestions/${recommendation.id}/dismiss`,
        { method: 'POST' },
      );
      setRecommendations((current) =>
        current.filter((item) => item.id !== recommendation.id),
      );
    } catch {
      setError('We could not dismiss this suggestion.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-6 rounded-lg border border-emerald-200 bg-white p-5 shadow-sm">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-highland">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> AI Trip Assistant
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-950">
          Suggestions stay separate until you accept them
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Recommendations use eligible public EthioTravel candidates. They do
          not reserve availability or alter bookings and payments.
        </p>
      </div>
      {disabled ? (
        <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
          Archived trips are read-only, so AI suggestions cannot be applied.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={busy}
              onClick={() => void generate(action.intent, action.instruction)}
              className="rounded-md border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-60"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900"
        >
          {error}
        </p>
      ) : null}
      {summary ? (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {summary}
        </p>
      ) : null}
      {recommendations.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {recommendations.map((recommendation) => (
            <AiRecommendationCard
              key={
                recommendation.id ??
                `${recommendation.entityType}-${recommendation.entityId}`
              }
              recommendation={recommendation}
              busy={busy}
              onAccept={() => void apply(recommendation)}
              onIgnore={() => void dismiss(recommendation)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
