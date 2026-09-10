import { AiIntent, TripItemType } from '@prisma/client';

export const AI_PROVIDER = 'ETHIOTRAVEL_AI_PROVIDER';

export type AiGroundedCandidate = {
  entityType: Extract<
    TripItemType,
    'DESTINATION' | 'ATTRACTION' | 'BUSINESS' | 'SERVICE'
  >;
  entityId: string;
  name: string;
  slug: string;
  category: string | null;
  location: string | null;
  description: string | null;
  knownPrice: { amount: string; currency: string } | null;
  availability: 'UNKNOWN';
};

export type AiProviderHistoryMessage = {
  role: 'USER' | 'ASSISTANT';
  content: string;
};

export type AiProviderRequest = {
  intent: AiIntent;
  userMessage: string;
  preferences: Record<string, string | string[]>;
  history: AiProviderHistoryMessage[];
  trip: {
    title: string;
    startDate: string;
    endDate: string;
    origin: string | null;
    destination: string | null;
    days: Array<{ dayNumber: number; date: string; items: string[] }>;
  } | null;
  candidates: AiGroundedCandidate[];
  maxOutputTokens: number;
  timeoutMs: number;
};

export type AiProviderCompletion = {
  rawContent: string;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
};

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  complete(request: AiProviderRequest): Promise<AiProviderCompletion>;
}

export class AiProviderUnavailableError extends Error {}
export class AiProviderTimeoutError extends Error {}
export class AiProviderResponseError extends Error {}
