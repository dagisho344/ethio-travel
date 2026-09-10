'use client';

import { LoaderCircle, Plus, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  createAiConversation,
  getAiConversation,
  getAiConversations,
  sendAiMessage,
} from '../../lib/ai';
import { BffRequestError } from '../../lib/private-api';
import type { AiConversation, AiRecommendation } from '../../lib/types';
import { Container } from '../ui/Container';
import { AiRecommendationCard } from './AiRecommendationCard';

function displayTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function AiAssistantClient() {
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [active, setActive] = useState<AiConversation | null>(null);
  const [recommendations, setRecommendations] = useState<AiRecommendation[]>(
    [],
  );
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAiConversations();
      setConversations(response.data);
      if (!active && response.data[0]) {
        setActive(await getAiConversation(response.data[0].id));
      }
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  async function selectConversation(id: string) {
    setBusy(true);
    setError(null);
    try {
      setActive(await getAiConversation(id));
      setRecommendations([]);
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(false);
    }
  }

  async function createConversation() {
    setBusy(true);
    setError(null);
    try {
      const conversation = await createAiConversation({});
      setConversations((current) => [conversation, ...current]);
      setActive(conversation);
      setRecommendations([]);
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const message = content.trim();
    if (!message) {
      setError('Write a travel question before sending.');
      return;
    }
    if (message.length > 2000) {
      setError('Keep your question to 2,000 characters or fewer.');
      return;
    }
    let conversation = active;
    setBusy(true);
    setError(null);
    setUnavailable(false);
    try {
      if (!conversation) conversation = await createAiConversation({});
      const response = await sendAiMessage(conversation.id, {
        content: message,
      });
      setActive(response.conversation);
      setRecommendations(response.recommendations);
      setContent('');
      setConversations((current) => {
        const without = current.filter(
          (item) => item.id !== response.conversation.id,
        );
        return [response.conversation, ...without];
      });
    } catch (cause) {
      if (cause instanceof BffRequestError && cause.status === 503) {
        setUnavailable(true);
      }
      setError(messageFor(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-12rem)] bg-slate-50">
      <Container className="py-8 sm:py-10">
        <header className="mb-6 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-highland">
            AI Travel Assistant
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            Plan with grounded EthioTravel recommendations
          </h1>
          <p className="mt-2 text-slate-600">
            Advice is generated from eligible EthioTravel listings. It does not
            reserve services, guarantee availability, or change your trip until
            you explicitly accept a suggestion.
          </p>
        </header>
        {unavailable ? (
          <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            AI recommendations are temporarily unavailable. You can continue
            using the normal Trip Planner.
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            {error}
          </p>
        ) : null}
        <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <button
              type="button"
              disabled={busy}
              onClick={() => void createConversation()}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-highland px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> New conversation
            </button>
            <div
              className="mt-3 space-y-1"
              aria-label="Assistant conversations"
            >
              {loading ? (
                <p className="p-3 text-sm text-slate-500">Loading?</p>
              ) : null}
              {!loading && !conversations.length ? (
                <p className="p-3 text-sm text-slate-500">
                  Start a conversation to get grounded travel ideas.
                </p>
              ) : null}
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => void selectConversation(conversation.id)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50 ${active?.id === conversation.id ? 'bg-emerald-50 text-highland' : 'text-slate-700'}`}
                >
                  <span className="block truncate font-semibold">
                    {conversation.title ?? 'New travel question'}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {displayTime(conversation.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          </aside>
          <section className="flex min-h-[34rem] flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <h2 className="font-bold text-slate-950">
                {active?.title ?? 'Ask about your trip'}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                AI-generated advice; platform records and booking rules remain
                authoritative.
              </p>
            </div>
            <div className="flex-1 space-y-4 p-4">
              {!active?.messages.length ? (
                <div className="rounded-lg bg-slate-50 p-5 text-sm text-slate-600">
                  Ask about real destinations, attractions, verified businesses,
                  or services. You can also connect a conversation to a trip
                  later from the Trip Planner.
                </div>
              ) : null}
              {active?.messages.map((message) => (
                <article
                  key={message.id}
                  className={`max-w-2xl rounded-lg p-4 text-sm leading-6 ${message.role === 'USER' ? 'ml-auto bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'}`}
                >
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-75">
                    {message.role === 'USER' ? 'You' : 'EthioTravel AI'}
                  </p>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </article>
              ))}
              {recommendations.map((recommendation) => (
                <AiRecommendationCard
                  key={`${recommendation.entityType}-${recommendation.entityId}`}
                  recommendation={recommendation}
                />
              ))}
              {active?.suggestions.length ? (
                <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
                  This conversation also has {active.suggestions.length} saved
                  trip suggestion{active.suggestions.length === 1 ? '' : 's'}{' '}
                  available from its associated trip.
                </div>
              ) : null}
            </div>
            <div className="border-t border-slate-100 p-4">
              <label htmlFor="assistant-message" className="sr-only">
                Travel question
              </label>
              <textarea
                id="assistant-message"
                value={content}
                maxLength={2000}
                disabled={busy}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder="Ask where to stay, what to do, or how to improve a trip?"
                className="min-h-24 w-full rounded-md border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-highland focus:ring-2 focus:ring-highland/20 disabled:bg-slate-50"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  {content.length}/2000 ? Enter to send, Shift+Enter for a new
                  line
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void send()}
                  className="inline-flex items-center gap-2 rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {busy ? (
                    <LoaderCircle
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden="true" />
                  )}
                  Send
                </button>
              </div>
            </div>
          </section>
        </div>
      </Container>
    </main>
  );
}

function messageFor(cause: unknown): string {
  if (cause instanceof BffRequestError) return cause.message;
  return 'We could not reach the travel assistant right now.';
}
