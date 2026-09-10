import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import test from 'node:test';

const root = process.cwd();
/** @param {string} path */
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

void test('AI BFF uses the authenticated server session and same-origin mutations', () => {
  const helper = read('app/api/ai/bff.ts');
  assert.match(helper, /authenticatedBackendJson/);
  assert.match(helper, /validateSameOrigin\(request\)/);
  assert.match(helper, /clearAuthCookies/);
  assert.doesNotMatch(
    helper,
    /localStorage|sessionStorage|accessToken|refreshToken|AI_API_KEY/,
  );
  for (const path of [
    'app/api/ai/conversations/route.ts',
    'app/api/ai/conversations/[id]/route.ts',
    'app/api/ai/conversations/[id]/messages/route.ts',
    'app/api/trips/[id]/ai/suggestions/route.ts',
    'app/api/trips/[id]/ai/suggestions/[suggestionId]/apply/route.ts',
    'app/api/trips/[id]/ai/suggestions/[suggestionId]/dismiss/route.ts',
  ]) {
    assert.match(read(path), /aiRouteResponse/, path);
  }
});

void test('assistant route requires an HttpOnly-backed authenticated session', () => {
  const source = read('app/assistant/page.tsx');
  assert.match(source, /currentTokens/);
  assert.match(source, /redirect/);
  assert.match(source, /returnTo=\/assistant/);
});

void test('assistant UI renders conversation history, validation, loading, and unavailable states', () => {
  const source = read('components/ai/AiAssistantClient.tsx');
  assert.match(source, /getAiConversations/);
  assert.match(source, /createAiConversation/);
  assert.match(source, /sendAiMessage/);
  assert.match(source, /message\.role/);
  assert.match(source, /message\.content/);
  assert.match(source, /content\.trim\(\)/);
  assert.match(source, /message\.length > 2000/);
  assert.match(source, /LoaderCircle/);
  assert.match(source, /temporarily unavailable/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
});

void test('recommendation cards identify generated advice and link to a real public search', () => {
  const source = read('components/ai/AiRecommendationCard.tsx');
  assert.match(source, /AI suggestion/);
  assert.match(source, /\/explore\?/);
  assert.match(source, /Known listed price/);
  assert.match(source, /Availability is not guaranteed/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
});

void test('trip AI suggestions are advisory and require explicit accept or ignore actions', () => {
  const source = read('components/ai/TripAiAssistant.tsx');
  assert.match(source, /generateTripAiSuggestions/);
  assert.match(source, /\/apply/);
  assert.match(source, /\/dismiss/);
  assert.match(source, /onApplied/);
  assert.match(source, /Suggestions stay separate until you accept them/);
  assert.doesNotMatch(
    source,
    /localStorage|sessionStorage|accessToken|refreshToken/,
  );
  assert.match(
    read('components/trips/TripPlannerClient.tsx'),
    /TripAiAssistant/,
  );
});

void test('client AI helpers use only same-origin BFF endpoints', () => {
  const source = read('lib/ai.ts');
  assert.match(source, /bffJson/);
  assert.match(source, /\/api\/ai\/conversations/);
  assert.match(source, /\/api\/trips\/\$\{tripId\}\/ai\/suggestions/);
  assert.doesNotMatch(
    source,
    /NEXT_PUBLIC.*AI|AI_API_KEY|localStorage|sessionStorage/,
  );
});

void test('AI BFF treats every non-GET route as a same-origin mutation', () => {
  const helper = read('app/api/ai/bff.ts');
  assert.match(helper, /init\.method && init\.method !== 'GET'/);
  assert.match(helper, /validateSameOrigin\(request\)/);
});

void test('AI BFF preserves backend authorization errors and clears expired server cookies', () => {
  const helper = read('app/api/ai/bff.ts');
  assert.match(helper, /jsonError\(error\)/);
  assert.match(helper, /response\.status === 401/);
  assert.match(helper, /clearAuthCookies\(response\)/);
});

void test('trip AI BFF routes do not expose provider credentials to the browser', () => {
  for (const path of [
    'app/api/trips/[id]/ai/suggestions/route.ts',
    'app/api/trips/[id]/ai/suggestions/[suggestionId]/apply/route.ts',
    'app/api/trips/[id]/ai/suggestions/[suggestionId]/dismiss/route.ts',
  ]) {
    const source = read(path);
    assert.match(source, /aiRouteResponse/);
    assert.doesNotMatch(
      source,
      /AI_API_KEY|NEXT_PUBLIC.*AI|accessToken|refreshToken/,
    );
  }
});

void test('assistant composer handles keyboard submit and prevents duplicate sends while busy', () => {
  const source = read('components/ai/AiAssistantClient.tsx');
  assert.match(source, /event\.key === 'Enter' && !event\.shiftKey/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /disabled=\{busy\}/);
  assert.match(source, /setContent\(''\)/);
});

void test('assistant renders model content as plain text rather than raw HTML', () => {
  const source = read('components/ai/AiAssistantClient.tsx');
  assert.match(
    source,
    /<p className="whitespace-pre-wrap">\{message\.content\}<\/p>/,
  );
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|innerHTML/);
});

void test('assistant recommendations remain linked to the active real conversation response', () => {
  const source = read('components/ai/AiAssistantClient.tsx');
  assert.match(source, /setRecommendations\(response\.recommendations\)/);
  assert.match(source, /setActive\(response\.conversation\)/);
  assert.match(source, /item\.id !== response\.conversation\.id/);
});

void test('trip assistant provides generation and improvement actions without automatic mutation', () => {
  const source = read('components/ai/TripAiAssistant.tsx');
  assert.match(source, /TRIP_ITINERARY/);
  assert.match(source, /TRIP_IMPROVEMENT/);
  assert.match(source, /generateTripAiSuggestions/);
  assert.doesNotMatch(source, /TripsService|prisma\./);
});

void test('trip assistant disables application actions for archived trips', () => {
  const source = read('components/ai/TripAiAssistant.tsx');
  assert.match(source, /\{disabled \?/);
  assert.match(source, /Archived trips are read-only/);
  assert.match(source, /disabled=\{busy\}/);
});

void test('trip assistant handles provider unavailability without modifying the itinerary', () => {
  const source = read('components/ai/TripAiAssistant.tsx');
  assert.match(source, /cause\.status === 503/);
  assert.match(source, /temporarily unavailable/);
  assert.match(source, /Your itinerary was not changed/);
});

void test('authenticated navigation exposes the AI assistant without storing credentials', () => {
  const layout = read('components/layout/PublicLayout.tsx');
  const navigation = read('components/layout/HeaderNavigation.tsx');
  assert.match(layout, /AI Assistant/);
  assert.match(layout, /href: '\/assistant'/);
  assert.doesNotMatch(navigation, /localStorage|sessionStorage/);
});
