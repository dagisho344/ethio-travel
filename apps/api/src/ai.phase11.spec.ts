import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GatewayTimeoutException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AiIntent,
  AiSuggestionStatus,
  TripItemType,
  UserStatus,
} from '@prisma/client';
import { AiRateLimiterService } from './ai/ai-rate-limiter.service';
import { AiService } from './ai/ai.service';
import {
  AiGroundedCandidate,
  AiProvider,
  AiProviderCompletion,
  AiProviderRequest,
  AiProviderTimeoutError,
  AiProviderUnavailableError,
} from './ai/providers/ai.provider';

const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';
const tripId = '33333333-3333-4333-8333-333333333333';
const conversationId = '44444444-4444-4444-8444-444444444444';
const suggestionId = '55555555-5555-4555-8555-555555555555';
const targetId = '66666666-6666-4666-8666-666666666666';
const dayId = '77777777-7777-4777-877777777777';

const candidate: AiGroundedCandidate = {
  entityType: TripItemType.ATTRACTION,
  entityId: targetId,
  name: 'Lake View',
  slug: 'lake-view',
  category: 'NATURAL',
  location: 'Hawassa',
  description: 'A public attraction.',
  knownPrice: null,
  availability: 'UNKNOWN',
};

function ownedTrip() {
  return {
    id: tripId,
    title: 'Hawassa break',
    startDate: '2030-06-10',
    endDate: '2030-06-11',
    originCity: null,
    destinationCity: { id: targetId, name: 'Hawassa', slug: 'hawassa' },
    primaryDestination: null,
    days: [
      {
        id: dayId,
        dayNumber: 1,
        date: '2030-06-10',
        items: [],
      },
    ],
  };
}

function conversation(overrides: Record<string, unknown> = {}) {
  return {
    id: conversationId,
    userId,
    tripId,
    title: null,
    archivedAt: null,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    messages: [],
    suggestions: [],
    trip: {
      id: tripId,
      title: 'Hawassa break',
      startDate: new Date(),
      endDate: new Date(),
    },
    ...overrides,
  };
}

function suggestion(overrides: Record<string, unknown> = {}) {
  return {
    id: suggestionId,
    userId,
    tripId,
    conversationId: null,
    tripItemType: TripItemType.ATTRACTION,
    targetEntityId: targetId,
    titleSnapshot: 'Lake View',
    reason: 'Fits your requested day.',
    suggestedDayNumber: 1,
    suggestedDate: new Date('2030-06-10T00:00:00.000Z'),
    notes: null,
    status: AiSuggestionStatus.PENDING,
    appliedTripItemId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    appliedAt: null,
    ...overrides,
  };
}

function response(entityId = targetId, entityType = 'ATTRACTION') {
  return JSON.stringify({
    summary: 'Visit the public attraction on day one.',
    recommendations: [
      {
        entityType,
        entityId,
        reason: 'It is in the grounded candidate set.',
        suggestedDay: 1,
      },
    ],
  });
}

function setup(providerError?: Error) {
  const tx = {
    aiMessage: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    aiConversation: { update: jest.fn().mockResolvedValue(conversation()) },
    aiSuggestion: { create: jest.fn().mockResolvedValue({ id: suggestionId }) },
  };
  const prisma = {
    user: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: userId, status: UserStatus.ACTIVE }),
    },
    aiConversation: {
      create: jest.fn().mockResolvedValue(conversation()),
      findFirst: jest.fn().mockResolvedValue(conversation()),
      findMany: jest.fn().mockResolvedValue([conversation()]),
      count: jest.fn().mockResolvedValue(1),
    },
    aiMessage: { createMany: jest.fn() },
    aiSuggestion: {
      findFirst: jest.fn().mockResolvedValue(suggestion()),
      create: jest.fn(),
      update: jest
        .fn()
        .mockResolvedValue(suggestion({ status: AiSuggestionStatus.APPLIED })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    aiUsage: { create: jest.fn().mockResolvedValue({ id: targetId }) },
    $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };
  const trips = {
    findOne: jest.fn().mockResolvedValue(ownedTrip()),
    addItem: jest
      .fn()
      .mockResolvedValue({ id: targetId, type: TripItemType.ATTRACTION }),
  };
  const grounding = {
    candidates: jest.fn().mockResolvedValue([candidate]),
    findEligible: jest.fn().mockResolvedValue(candidate),
  };
  const limiter = { consume: jest.fn().mockResolvedValue(undefined) };
  const config = {
    get: jest.fn((key: string) =>
      key === 'aiMaxOutputTokens'
        ? 300
        : key === 'aiRequestTimeoutMs'
          ? 5000
          : undefined,
    ),
  };
  const complete = jest
    .fn<Promise<AiProviderCompletion>, [AiProviderRequest]>()
    .mockImplementation(() => {
      if (providerError) return Promise.reject(providerError);
      return Promise.resolve({
        rawContent: response(),
        provider: 'FAKE',
        model: 'fake-model',
      });
    });
  const provider: AiProvider = { name: 'FAKE', model: 'fake-model', complete };
  return {
    prisma,
    trips,
    grounding,
    limiter,
    provider,
    complete,
    service: new AiService(
      prisma as never,
      trips as never,
      grounding as never,
      limiter as never,
      config as never,
      provider,
    ),
  };
}

describe('AiService', () => {
  it('creates an authenticated conversation and validates an associated owned trip', async () => {
    const { service, trips, prisma } = setup();
    await service.createConversation(userId, {
      tripId,
      title: ' Hawassa ideas ',
    });
    expect(trips.findOne).toHaveBeenCalledWith(userId, tripId);
    expect(prisma.aiConversation.create).toHaveBeenCalled();
  });

  it('does not reveal another user conversation', async () => {
    const { service, prisma } = setup();
    prisma.aiConversation.findFirst.mockResolvedValue(null);
    await expect(
      service.findOne(otherUserId, conversationId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.aiConversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: conversationId, userId: otherUserId },
      }),
    );
  });

  it('uses a fake provider, bounded history, and persists messages only after a valid response', async () => {
    const history = Array.from({ length: 15 }, (_, index) => ({
      id: `message-${index}`,
      role: index % 2 === 0 ? 'USER' : 'ASSISTANT',
      content: `Previous message ${index}`,
      createdAt: new Date(),
    }));
    const { service, complete, prisma } = setup();
    prisma.aiConversation.findFirst.mockResolvedValue(
      conversation({ messages: history }),
    );
    const result = await service.sendMessage(userId, conversationId, {
      content: ' What can I do? ',
      intent: AiIntent.TRIP_ITINERARY,
    });
    const request = complete.mock.calls[0]?.[0];
    expect(request?.history).toHaveLength(12);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result.recommendations).toHaveLength(1);
  });

  it('does not expose a recommendation when public grounding returns no eligible candidates', async () => {
    const { service, grounding, complete } = setup();
    grounding.candidates.mockResolvedValue([]);
    complete.mockResolvedValue({
      rawContent: response(),
      provider: 'FAKE',
      model: 'fake-model',
    });
    const result = await service.sendMessage(userId, conversationId, {
      content: 'Recommend a private listing',
      intent: AiIntent.ATTRACTION_RECOMMENDATION,
    });
    expect(result.recommendations).toEqual([]);
  });

  it('refuses suggestions for a trip the current user cannot read', async () => {
    const { service, trips } = setup();
    trips.findOne.mockRejectedValue(new NotFoundException());
    await expect(
      service.generateTripSuggestions(userId, tripId, {
        intent: AiIntent.TRIP_ITINERARY,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('preserves known prices exactly and leaves unknown prices null in advice', async () => {
    const pricedCandidate = {
      ...candidate,
      knownPrice: { amount: '250.00', currency: 'ETB' },
    };
    const { service, grounding } = setup();
    grounding.candidates.mockResolvedValue([pricedCandidate]);
    const result = await service.sendMessage(userId, conversationId, {
      content: 'What is the cost?',
      intent: AiIntent.ATTRACTION_RECOMMENDATION,
    });
    expect(result.recommendations[0]?.knownPrice).toEqual({
      amount: '250.00',
      currency: 'ETB',
    });
  });
  it('rejects blank prompts before calling the provider or persisting messages', async () => {
    const { service, complete, prisma } = setup();
    await expect(
      service.sendMessage(userId, conversationId, {
        content: '   ',
        intent: AiIntent.GENERAL_TRAVEL,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(complete).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns controlled errors for unavailable and timed-out providers without persisting a message', async () => {
    const unavailable = setup(new AiProviderUnavailableError());
    await expect(
      unavailable.service.sendMessage(userId, conversationId, {
        content: 'Suggest a destination',
        intent: AiIntent.DESTINATION_DISCOVERY,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(unavailable.prisma.$transaction).not.toHaveBeenCalled();

    const timedOut = setup(new AiProviderTimeoutError());
    await expect(
      timedOut.service.sendMessage(userId, conversationId, {
        content: 'Suggest a destination',
        intent: AiIntent.DESTINATION_DISCOVERY,
      }),
    ).rejects.toBeInstanceOf(GatewayTimeoutException);
    expect(timedOut.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects malformed provider output without persisting user or assistant content', async () => {
    const { service, complete, prisma } = setup();
    complete.mockResolvedValue({
      rawContent: 'not structured JSON',
      provider: 'FAKE',
      model: 'fake-model',
    });
    await expect(
      service.sendMessage(userId, conversationId, {
        content: 'Plan my trip',
        intent: AiIntent.TRIP_ITINERARY,
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('discards hallucinated IDs and entity types rather than presenting them as recommendations', async () => {
    const { service, complete } = setup();
    complete.mockResolvedValue({
      rawContent: response('88888888-8888-4888-8888-888888888888'),
      provider: 'FAKE',
      model: 'fake-model',
    });
    const hallucinated = await service.sendMessage(userId, conversationId, {
      content: 'Recommend an attraction',
      intent: AiIntent.ATTRACTION_RECOMMENDATION,
    });
    expect(hallucinated.recommendations).toEqual([]);

    complete.mockResolvedValue({
      rawContent: response(targetId, 'BUSINESS'),
      provider: 'FAKE',
      model: 'fake-model',
    });
    const wrongType = await service.sendMessage(userId, conversationId, {
      content: 'Recommend an attraction',
      intent: AiIntent.ATTRACTION_RECOMMENDATION,
    });
    expect(wrongType.recommendations).toEqual([]);
  });

  it('creates trip suggestions as proposals without changing the itinerary', async () => {
    const { service, trips, prisma } = setup();
    const result = await service.generateTripSuggestions(userId, tripId, {
      intent: AiIntent.TRIP_ITINERARY,
      instruction: 'Prefer culture.',
    });
    expect(result.recommendations[0]?.entityId).toBe(targetId);
    expect(trips.addItem).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('applies an owned still-eligible suggestion through TripsService only after explicit confirmation', async () => {
    const { service, trips, grounding, prisma } = setup();
    const result = await service.applySuggestion(userId, tripId, suggestionId);
    expect(grounding.findEligible).toHaveBeenCalledWith(
      TripItemType.ATTRACTION,
      targetId,
    );
    expect(trips.addItem).toHaveBeenCalledWith(
      userId,
      tripId,
      dayId,
      expect.objectContaining({
        type: TripItemType.ATTRACTION,
        attractionId: targetId,
      }),
    );
    expect(result.tripItem.id).toBe(targetId);
    expect(prisma.aiSuggestion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: AiSuggestionStatus.APPLYING },
      }),
    );
  });

  it('does not apply a suggestion after its referenced entity is no longer eligible', async () => {
    const { service, trips, grounding, prisma } = setup();
    grounding.findEligible.mockResolvedValue(null);
    await expect(
      service.applySuggestion(userId, tripId, suggestionId),
    ).rejects.toBeInstanceOf(HttpException);
    expect(trips.addItem).not.toHaveBeenCalled();
    expect(prisma.aiSuggestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: AiSuggestionStatus.INVALID },
      }),
    );
  });
  it('lists only the current user active conversations with pagination', async () => {
    const { service, prisma } = setup();
    const result = await service.findMine(userId, { page: 1, limit: 5 });
    expect(result.data).toHaveLength(1);
    expect(prisma.aiConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId, archivedAt: null },
        skip: 0,
        take: 5,
      }),
    );
  });

  it('requires an active user before creating a conversation', async () => {
    const { service, prisma } = setup();
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.createConversation(userId, { title: 'Ideas' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.aiConversation.create).not.toHaveBeenCalled();
  });

  it('rejects a conversation association for a trip the user does not own', async () => {
    const { service, trips } = setup();
    trips.findOne.mockRejectedValue(new NotFoundException());
    await expect(
      service.createConversation(userId, { tripId, title: 'Private trip' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps unknown prices unknown rather than fabricating an estimate', async () => {
    const { service } = setup();
    const result = await service.sendMessage(userId, conversationId, {
      content: 'What will this cost?',
      intent: AiIntent.ATTRACTION_RECOMMENDATION,
    });
    expect(result.recommendations[0]?.knownPrice).toBeNull();
  });

  it('uses only the owned trip context to scope grounded candidates', async () => {
    const { service, grounding, complete } = setup();
    await service.generateTripSuggestions(userId, tripId, {
      intent: AiIntent.TRIP_ITINERARY,
    });
    expect(grounding.candidates).toHaveBeenCalledWith({
      destinationCityId: targetId,
      primaryDestinationId: undefined,
    });
    expect(complete.mock.calls[0]?.[0]?.trip?.destination).toBe('Hawassa');
  });

  it('drops proposals with a trip day outside the owned itinerary', async () => {
    const { service, complete } = setup();
    complete.mockResolvedValue({
      rawContent: JSON.stringify({
        summary: 'Use an impossible day.',
        recommendations: [
          {
            entityType: 'ATTRACTION',
            entityId: targetId,
            reason: 'Invalid day.',
            suggestedDay: 9,
          },
        ],
      }),
      provider: 'FAKE',
      model: 'fake-model',
    });
    const result = await service.generateTripSuggestions(userId, tripId, {
      intent: AiIntent.TRIP_ITINERARY,
    });
    expect(result.recommendations).toEqual([]);
  });

  it('does not apply a suggestion twice when its pending claim is lost', async () => {
    const { service, prisma, trips } = setup();
    prisma.aiSuggestion.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.applySuggestion(userId, tripId, suggestionId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(trips.addItem).not.toHaveBeenCalled();
  });

  it('returns a failed application to pending instead of corrupting the suggestion', async () => {
    const { service, trips, prisma } = setup();
    trips.addItem.mockRejectedValue(new BadRequestException());
    await expect(
      service.applySuggestion(userId, tripId, suggestionId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.aiSuggestion.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { status: AiSuggestionStatus.PENDING },
      }),
    );
  });

  it('allows a user to dismiss only a pending suggestion on their own trip', async () => {
    const { service, prisma } = setup();
    const result = await service.dismissSuggestion(
      userId,
      tripId,
      suggestionId,
    );
    expect(result).toEqual({ dismissed: true });
    expect(prisma.aiSuggestion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: suggestionId,
          userId,
          tripId,
          status: AiSuggestionStatus.PENDING,
        },
        data: { status: AiSuggestionStatus.DISMISSED },
      }),
    );
  });

  it('does not disclose or update a missing suggestion during dismissal', async () => {
    const { service, prisma } = setup();
    prisma.aiSuggestion.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.dismissSuggestion(otherUserId, tripId, suggestionId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('enforces the narrow per-user fallback limiter when Redis is unavailable', async () => {
    const config = { get: jest.fn().mockReturnValue(1) };
    const redis = { incrementWithExpiry: jest.fn().mockResolvedValue(null) };
    const limiter = new AiRateLimiterService(config as never, redis as never);
    await limiter.consume(userId);
    await expect(limiter.consume(userId)).rejects.toBeInstanceOf(HttpException);
  });
});
