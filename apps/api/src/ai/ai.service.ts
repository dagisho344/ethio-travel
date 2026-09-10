import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiIntent,
  AiMessageRole,
  AiSuggestionStatus,
  Prisma,
  TripItemType,
  UserStatus,
} from '@prisma/client';
import { paginate } from '../common/dto/pagination.dto';
import { AppConfig } from '../config/app.config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTripItemDto } from '../trips/dto/trip.dto';
import { TripsService } from '../trips/trips.service';
import { AiRateLimiterService } from './ai-rate-limiter.service';
import {
  AiConversationQueryDto,
  AiPreferencesDto,
  CreateAiConversationDto,
  GenerateTripSuggestionsDto,
  SendAiMessageDto,
} from './dto/ai.dto';
import { AiGroundingService } from './grounding/ai-grounding.service';
import {
  AI_PROVIDER,
  AiGroundedCandidate,
  AiProvider,
  AiProviderCompletion,
  AiProviderHistoryMessage,
  AiProviderRequest,
  AiProviderResponseError,
  AiProviderTimeoutError,
  AiProviderUnavailableError,
} from './providers/ai.provider';

const MAX_HISTORY_MESSAGES = 12;
const MAX_SUGGESTIONS = 8;
type CandidateType = Extract<
  TripItemType,
  'DESTINATION' | 'ATTRACTION' | 'BUSINESS' | 'SERVICE'
>;
type ValidRecommendation = {
  candidate: AiGroundedCandidate;
  reason: string;
  suggestedDay: number | null;
  notes: string | null;
};
type ProviderResult = {
  summary: string;
  recommendations: ValidRecommendation[];
};
const conversationInclude = {
  messages: { orderBy: { createdAt: 'asc' }, take: 50 },
  suggestions: { orderBy: { createdAt: 'desc' }, take: 30 },
  trip: { select: { id: true, title: true, startDate: true, endDate: true } },
} satisfies Prisma.AiConversationInclude;
type ConversationRecord = Prisma.AiConversationGetPayload<{
  include: typeof conversationInclude;
}>;
type OwnedTrip = Awaited<ReturnType<TripsService['findOne']>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const result = value.trim();
  return result.length > 0 && result.length <= max ? result : null;
}
function candidateType(value: unknown): value is CandidateType {
  return (
    typeof value === 'string' &&
    ['DESTINATION', 'ATTRACTION', 'BUSINESS', 'SERVICE'].includes(value)
  );
}
function dayNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}
function dateAtUtc(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trips: TripsService,
    private readonly grounding: AiGroundingService,
    private readonly limiter: AiRateLimiterService,
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
  ) {}

  async createConversation(userId: string, dto: CreateAiConversationDto) {
    await this.ensureActiveUser(userId);
    if (dto.tripId) await this.trips.findOne(userId, dto.tripId);
    const conversation = await this.prisma.aiConversation.create({
      data: {
        userId,
        tripId: dto.tripId,
        title: this.cleanOptional(dto.title, 160),
      },
      include: conversationInclude,
    });
    return this.toConversation(conversation);
  }

  async findMine(userId: string, query: AiConversationQueryDto) {
    const where = { userId, archivedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.aiConversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: conversationInclude,
      }),
      this.prisma.aiConversation.count({ where }),
    ]);
    return paginate(
      data.map((conversation) => this.toConversation(conversation)),
      total,
      query.page,
      query.limit,
    );
  }

  async findOne(userId: string, conversationId: string) {
    return this.toConversation(
      await this.ownedConversation(userId, conversationId),
    );
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    dto: SendAiMessageDto,
  ) {
    const content = cleanString(dto.content, 2000);
    if (!content) throw new BadRequestException('AI message cannot be blank.');
    const conversation = await this.ownedConversation(userId, conversationId);
    const trip = conversation.tripId
      ? await this.trips.findOne(userId, conversation.tripId)
      : null;
    await this.limiter.consume(userId);
    const candidates = await this.grounding.candidates(this.scope(trip));
    const startedAt = Date.now();
    try {
      const completion = await this.provider.complete(
        this.providerRequest(
          dto.intent,
          content,
          dto.preferences,
          conversation,
          trip,
          candidates,
        ),
      );
      const result = this.validate(completion.rawContent, candidates, trip);
      const saved = trip
        ? await this.persistConversationResult(
            userId,
            conversation,
            content,
            result,
            trip,
          )
        : await this.persistConversationMessages(
            conversation,
            content,
            result.summary,
          );
      await this.recordUsage(
        userId,
        conversation.id,
        dto.intent,
        completion,
        Date.now() - startedAt,
        true,
      );
      return {
        conversation: this.toConversation(
          await this.ownedConversation(userId, conversationId),
        ),
        assistantMessage: result.summary,
        recommendations: this.recommendations(result.recommendations, saved),
      };
    } catch (error) {
      await this.recordUsage(
        userId,
        conversation.id,
        dto.intent,
        null,
        Date.now() - startedAt,
        false,
      );
      this.throwProviderFailure(error);
    }
  }

  async generateTripSuggestions(
    userId: string,
    tripId: string,
    dto: GenerateTripSuggestionsDto,
  ) {
    const trip = await this.trips.findOne(userId, tripId);
    await this.limiter.consume(userId);
    const instruction =
      this.cleanOptional(dto.instruction, 1200) ??
      (dto.intent === AiIntent.TRIP_IMPROVEMENT
        ? 'Improve this itinerary while preserving existing bookings.'
        : 'Suggest a practical itinerary using the grounded candidates.');
    const candidates = await this.grounding.candidates(this.scope(trip));
    const startedAt = Date.now();
    try {
      const completion = await this.provider.complete(
        this.providerRequest(
          dto.intent,
          instruction,
          dto.preferences,
          null,
          trip,
          candidates,
        ),
      );
      const result = this.validate(completion.rawContent, candidates, trip);
      const saved = await this.persistSuggestions(
        userId,
        trip,
        null,
        result.recommendations,
      );
      await this.recordUsage(
        userId,
        null,
        dto.intent,
        completion,
        Date.now() - startedAt,
        true,
      );
      return {
        summary: result.summary,
        recommendations: this.recommendations(result.recommendations, saved),
      };
    } catch (error) {
      await this.recordUsage(
        userId,
        null,
        dto.intent,
        null,
        Date.now() - startedAt,
        false,
      );
      this.throwProviderFailure(error);
    }
  }

  async applySuggestion(userId: string, tripId: string, suggestionId: string) {
    const trip = await this.trips.findOne(userId, tripId);
    const suggestion = await this.prisma.aiSuggestion.findFirst({
      where: { id: suggestionId, userId, tripId },
    });
    if (!suggestion || suggestion.status !== AiSuggestionStatus.PENDING)
      throw new NotFoundException('AI suggestion not found.');
    const claim = await this.prisma.aiSuggestion.updateMany({
      where: { id: suggestion.id, status: AiSuggestionStatus.PENDING },
      data: { status: AiSuggestionStatus.APPLYING },
    });
    if (claim.count !== 1)
      throw new ConflictException('AI suggestion is already being applied.');
    const candidate = await this.grounding.findEligible(
      suggestion.tripItemType as CandidateType,
      suggestion.targetEntityId,
    );
    const day = trip.days.find(
      (item) =>
        item.dayNumber === suggestion.suggestedDayNumber &&
        item.date.slice(0, 10) ===
          suggestion.suggestedDate.toISOString().slice(0, 10),
    );
    if (!candidate || !day) {
      await this.prisma.aiSuggestion.update({
        where: { id: suggestion.id },
        data: { status: AiSuggestionStatus.INVALID },
      });
      throw new ConflictException('This AI suggestion is no longer valid.');
    }
    let tripItem;
    try {
      tripItem = await this.trips.addItem(
        userId,
        tripId,
        day.id,
        this.toTripItemInput(candidate, suggestion.notes),
      );
    } catch (error) {
      await this.prisma.aiSuggestion.updateMany({
        where: { id: suggestion.id, status: AiSuggestionStatus.APPLYING },
        data: { status: AiSuggestionStatus.PENDING },
      });
      throw error;
    }
    const applied = await this.prisma.aiSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: AiSuggestionStatus.APPLIED,
        appliedAt: new Date(),
        appliedTripItemId: tripItem.id,
      },
    });
    return { suggestion: this.toSuggestion(applied), tripItem };
  }

  async dismissSuggestion(
    userId: string,
    tripId: string,
    suggestionId: string,
  ) {
    const result = await this.prisma.aiSuggestion.updateMany({
      where: {
        id: suggestionId,
        userId,
        tripId,
        status: AiSuggestionStatus.PENDING,
      },
      data: { status: AiSuggestionStatus.DISMISSED },
    });
    if (result.count !== 1)
      throw new NotFoundException('AI suggestion not found.');
    return { dismissed: true };
  }
  private async persistConversationMessages(
    conversation: ConversationRecord,
    userContent: string,
    assistantContent: string,
  ): Promise<Array<{ id: string }>> {
    await this.prisma.$transaction(async (tx) => {
      await tx.aiMessage.createMany({
        data: [
          {
            conversationId: conversation.id,
            role: AiMessageRole.USER,
            content: userContent,
          },
          {
            conversationId: conversation.id,
            role: AiMessageRole.ASSISTANT,
            content: assistantContent,
          },
        ],
      });
      await tx.aiConversation.update({
        where: { id: conversation.id },
        data: { title: conversation.title ?? userContent.slice(0, 160) },
      });
    });
    return [];
  }

  private async persistConversationResult(
    userId: string,
    conversation: ConversationRecord,
    userContent: string,
    result: ProviderResult,
    trip: OwnedTrip,
  ): Promise<Array<{ id: string }>> {
    return this.prisma.$transaction(async (tx) => {
      await tx.aiMessage.createMany({
        data: [
          {
            conversationId: conversation.id,
            role: AiMessageRole.USER,
            content: userContent,
          },
          {
            conversationId: conversation.id,
            role: AiMessageRole.ASSISTANT,
            content: result.summary,
          },
        ],
      });
      await tx.aiConversation.update({
        where: { id: conversation.id },
        data: { title: conversation.title ?? userContent.slice(0, 160) },
      });
      return Promise.all(
        result.recommendations.map((recommendation) =>
          tx.aiSuggestion.create({
            data: this.suggestionData(
              userId,
              trip,
              conversation.id,
              recommendation,
            ),
            select: { id: true },
          }),
        ),
      );
    });
  }

  private async persistSuggestions(
    userId: string,
    trip: OwnedTrip,
    conversationId: string | null,
    recommendations: ValidRecommendation[],
  ): Promise<Array<{ id: string }>> {
    return this.prisma.$transaction((tx) =>
      Promise.all(
        recommendations.map((recommendation) =>
          tx.aiSuggestion.create({
            data: this.suggestionData(
              userId,
              trip,
              conversationId,
              recommendation,
            ),
            select: { id: true },
          }),
        ),
      ),
    );
  }

  private suggestionData(
    userId: string,
    trip: OwnedTrip,
    conversationId: string | null,
    recommendation: ValidRecommendation,
  ): Prisma.AiSuggestionUncheckedCreateInput {
    const day = trip.days.find(
      (item) => item.dayNumber === recommendation.suggestedDay,
    );
    if (!day)
      throw new BadGatewayException('AI suggested an invalid trip day.');
    return {
      userId,
      tripId: trip.id,
      conversationId,
      tripItemType: recommendation.candidate.entityType,
      targetEntityId: recommendation.candidate.entityId,
      titleSnapshot: recommendation.candidate.name,
      reason: recommendation.reason,
      suggestedDayNumber: day.dayNumber,
      suggestedDate: dateAtUtc(day.date),
      notes: recommendation.notes,
    };
  }

  private providerRequest(
    intent: AiIntent,
    userMessage: string,
    preferences: AiPreferencesDto | undefined,
    conversation: ConversationRecord | null,
    trip: OwnedTrip | null,
    candidates: AiGroundedCandidate[],
  ): AiProviderRequest {
    return {
      intent,
      userMessage,
      preferences: this.providerPreferences(preferences),
      history: (conversation?.messages ?? [])
        .slice(-MAX_HISTORY_MESSAGES)
        .map((message): AiProviderHistoryMessage => ({
          role: message.role === AiMessageRole.USER ? 'USER' : 'ASSISTANT',
          content: message.content,
        })),
      trip: trip
        ? {
            title: trip.title,
            startDate: trip.startDate,
            endDate: trip.endDate,
            origin: trip.originCity?.name ?? null,
            destination:
              trip.primaryDestination?.name ??
              trip.destinationCity?.name ??
              null,
            days: trip.days.map((day) => ({
              dayNumber: day.dayNumber,
              date: day.date,
              items: day.items.map((item) => item.title ?? item.type),
            })),
          }
        : null,
      candidates,
      maxOutputTokens: this.config.get('aiMaxOutputTokens', { infer: true }),
      timeoutMs: this.config.get('aiRequestTimeoutMs', { infer: true }),
    };
  }

  private providerPreferences(
    preferences: AiPreferencesDto | undefined,
  ): Record<string, string | string[]> {
    if (!preferences) return {};
    const result: Record<string, string | string[]> = {};
    if (preferences.budget) result.budget = preferences.budget;
    if (preferences.pace) result.pace = preferences.pace;
    if (preferences.interests)
      result.interests = preferences.interests.map((interest) =>
        interest.trim(),
      );
    if (preferences.accommodationType)
      result.accommodationType = preferences.accommodationType.trim();
    if (preferences.transportPreference)
      result.transportPreference = preferences.transportPreference.trim();
    return result;
  }

  private validate(
    rawContent: string,
    candidates: AiGroundedCandidate[],
    trip: OwnedTrip | null,
  ): ProviderResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent) as unknown;
    } catch {
      throw new AiProviderResponseError('AI provider returned invalid JSON.');
    }
    if (!isRecord(parsed))
      throw new AiProviderResponseError('AI provider result was malformed.');
    const summary = cleanString(parsed.summary, 1500);
    if (!summary)
      throw new AiProviderResponseError(
        'AI provider returned no usable summary.',
      );
    const candidateByKey = new Map(
      candidates.map((candidate) => [
        `${candidate.entityType}:${candidate.entityId}`,
        candidate,
      ]),
    );
    const recommendations: ValidRecommendation[] = [];
    const rawRecommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.slice(0, MAX_SUGGESTIONS)
      : [];
    for (const raw of rawRecommendations) {
      if (!isRecord(raw) || !candidateType(raw.entityType)) continue;
      const entityId = cleanString(raw.entityId, 64);
      const reason = cleanString(raw.reason, 600);
      if (!entityId || !reason) continue;
      const candidate = candidateByKey.get(`${raw.entityType}:${entityId}`);
      if (!candidate) continue;
      const requestedDay = dayNumber(raw.suggestedDay);
      const suggestedDay = trip
        ? requestedDay &&
          trip.days.some((day) => day.dayNumber === requestedDay)
          ? requestedDay
          : null
        : null;
      if (trip && !suggestedDay) continue;
      const notes =
        raw.notes === undefined ? null : cleanString(raw.notes, 1000);
      if (raw.notes !== undefined && !notes) continue;
      recommendations.push({ candidate, reason, suggestedDay, notes });
    }
    return { summary, recommendations };
  }

  private recommendations(
    recommendations: ValidRecommendation[],
    saved: Array<{ id: string }>,
  ) {
    return recommendations.map((recommendation, index) => ({
      id: saved[index]?.id ?? null,
      entityType: recommendation.candidate.entityType,
      entityId: recommendation.candidate.entityId,
      name: recommendation.candidate.name,
      slug: recommendation.candidate.slug,
      category: recommendation.candidate.category,
      location: recommendation.candidate.location,
      knownPrice: recommendation.candidate.knownPrice,
      availability: recommendation.candidate.availability,
      reason: recommendation.reason,
      suggestedDay: recommendation.suggestedDay,
      notes: recommendation.notes,
    }));
  }

  private toConversation(conversation: ConversationRecord) {
    return {
      id: conversation.id,
      tripId: conversation.tripId,
      title: conversation.title,
      archivedAt: conversation.archivedAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      trip: conversation.trip,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
      suggestions: conversation.suggestions.map((suggestion) =>
        this.toSuggestion(suggestion),
      ),
    };
  }

  private toSuggestion(suggestion: {
    id: string;
    tripItemType: TripItemType;
    targetEntityId: string;
    titleSnapshot: string;
    reason: string;
    suggestedDayNumber: number;
    suggestedDate: Date;
    notes: string | null;
    status: AiSuggestionStatus;
    appliedTripItemId: string | null;
    createdAt: Date;
    appliedAt: Date | null;
  }) {
    return {
      id: suggestion.id,
      entityType: suggestion.tripItemType,
      entityId: suggestion.targetEntityId,
      name: suggestion.titleSnapshot,
      reason: suggestion.reason,
      suggestedDay: suggestion.suggestedDayNumber,
      suggestedDate: suggestion.suggestedDate,
      notes: suggestion.notes,
      status: suggestion.status,
      appliedTripItemId: suggestion.appliedTripItemId,
      createdAt: suggestion.createdAt,
      appliedAt: suggestion.appliedAt,
    };
  }

  private scope(trip: OwnedTrip | null) {
    return {
      destinationCityId: trip?.destinationCity?.id,
      primaryDestinationId: trip?.primaryDestination?.id,
    };
  }

  private toTripItemInput(
    candidate: AiGroundedCandidate,
    notes: string | null,
  ): CreateTripItemDto {
    const input = new CreateTripItemDto();
    input.type = candidate.entityType;
    if (notes) input.notes = notes;
    if (candidate.entityType === 'DESTINATION')
      input.destinationId = candidate.entityId;
    if (candidate.entityType === 'ATTRACTION')
      input.attractionId = candidate.entityId;
    if (candidate.entityType === 'BUSINESS')
      input.businessId = candidate.entityId;
    if (candidate.entityType === 'SERVICE')
      input.serviceId = candidate.entityId;
    return input;
  }

  private async ownedConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, userId },
      include: conversationInclude,
    });
    if (!conversation)
      throw new NotFoundException('AI conversation not found.');
    return conversation;
  }

  private async ensureActiveUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    if (!user) throw new ForbiddenException('Active user is required.');
  }

  private cleanOptional(value: string | undefined, max: number): string | null {
    return value ? cleanString(value, max) : null;
  }

  private async recordUsage(
    userId: string,
    conversationId: string | null,
    intent: AiIntent,
    completion: AiProviderCompletion | null,
    durationMs: number,
    success: boolean,
  ): Promise<void> {
    try {
      await this.prisma.aiUsage.create({
        data: {
          userId,
          conversationId,
          provider: completion?.provider ?? this.provider.name,
          model: completion?.model ?? this.provider.model,
          intent,
          inputTokens: completion?.inputTokens,
          outputTokens: completion?.outputTokens,
          durationMs,
          success,
        },
      });
      this.logger.log(
        `ai request provider=${completion?.provider ?? this.provider.name} intent=${intent} success=${success} durationMs=${durationMs}`,
      );
    } catch {
      this.logger.warn(
        `ai usage record failed provider=${this.provider.name} intent=${intent}`,
      );
    }
  }

  private throwProviderFailure(error: unknown): never {
    if (error instanceof AiProviderUnavailableError)
      throw new ServiceUnavailableException(
        'AI recommendations are temporarily unavailable. You can continue using the normal Trip Planner.',
      );
    if (error instanceof AiProviderTimeoutError)
      throw new GatewayTimeoutException(
        'AI recommendations timed out. Please try again later.',
      );
    if (error instanceof AiProviderResponseError)
      throw new BadGatewayException(
        'AI recommendations returned an invalid response.',
      );
    throw error;
  }
}
