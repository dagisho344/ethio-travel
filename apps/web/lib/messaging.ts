import type {
  Conversation,
  ConversationListResponse,
  CreateConversationInput,
  Message,
  MessageListResponse,
} from './types';
import { bffJson, queryString } from './private-api';

export const MESSAGE_MAX_LENGTH = 5000;

export function getConversations(
  query: {
    page?: number;
    limit?: number;
    status?: 'ACTIVE' | 'ARCHIVED';
    businessId?: string;
  } = {},
): Promise<ConversationListResponse> {
  return bffJson(`/api/conversations${queryString(query)}`);
}

export function createConversation(
  input: CreateConversationInput,
): Promise<Conversation> {
  return bffJson('/api/conversations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getConversation(id: string): Promise<Conversation> {
  return bffJson(`/api/conversations/${encodeURIComponent(id)}`);
}

export function getMessages(
  id: string,
  query: { page?: number; limit?: number } = {},
): Promise<MessageListResponse> {
  return bffJson(
    `/api/conversations/${encodeURIComponent(id)}/messages${queryString(query)}`,
  );
}

export function sendMessage(id: string, body: string): Promise<Message> {
  return bffJson(`/api/conversations/${encodeURIComponent(id)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export function markConversationRead(
  id: string,
): Promise<{ conversationId: string; lastReadAt: string }> {
  return bffJson(`/api/conversations/${encodeURIComponent(id)}/read`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
