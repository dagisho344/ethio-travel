import { bffJson, queryString } from './private-api';
import type {
  AiConversation,
  AiConversationListResponse,
  AiMessageResponse,
  AiRecommendationsResponse,
} from './types';

export function getAiConversations(page = 1, limit = 20) {
  return bffJson<AiConversationListResponse>(
    `/api/ai/conversations${queryString({ page, limit })}`,
  );
}

export function createAiConversation(input: {
  tripId?: string;
  title?: string;
}) {
  return bffJson<AiConversation>('/api/ai/conversations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getAiConversation(id: string) {
  return bffJson<AiConversation>(`/api/ai/conversations/${id}`);
}

export function sendAiMessage(
  id: string,
  input: { content: string; intent?: string },
) {
  return bffJson<AiMessageResponse>(`/api/ai/conversations/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function generateTripAiSuggestions(
  tripId: string,
  input: { intent: string; instruction?: string },
) {
  return bffJson<AiRecommendationsResponse>(
    `/api/trips/${tripId}/ai/suggestions`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}
