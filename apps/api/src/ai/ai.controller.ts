import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiService } from './ai.service';
import {
  AiConversationQueryDto,
  CreateAiConversationDto,
  GenerateTripSuggestionsDto,
  SendAiMessageDto,
} from './dto/ai.dto';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('conversations')
  @ApiCreatedResponse({ description: 'Owned AI conversation created.' })
  createConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAiConversationDto,
  ) {
    return this.ai.createConversation(user.sub, dto);
  }

  @Get('conversations')
  @ApiOkResponse({ description: 'Paginated owned AI conversations.' })
  findConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AiConversationQueryDto,
  ) {
    return this.ai.findMine(user.sub, query);
  }

  @Get('conversations/:id')
  @ApiOkResponse({ description: 'Owned AI conversation and bounded history.' })
  findConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.ai.findOne(user.sub, id);
  }

  @Post('conversations/:id/messages')
  @ApiOkResponse({
    description: 'Grounded AI response persisted after success.',
  })
  @ApiServiceUnavailableResponse({
    description: 'AI is disabled or unavailable.',
  })
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SendAiMessageDto,
  ) {
    return this.ai.sendMessage(user.sub, id, dto);
  }
}

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trips/:tripId/ai')
export class TripAiController {
  constructor(private readonly ai: AiService) {}

  @Post('suggestions')
  @ApiOkResponse({
    description: 'Grounded trip suggestions; no itinerary mutation.',
  })
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Body() dto: GenerateTripSuggestionsDto,
  ) {
    return this.ai.generateTripSuggestions(user.sub, tripId, dto);
  }

  @Post('suggestions/:suggestionId/apply')
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Explicitly applies one still-valid owned suggestion.',
  })
  apply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Param('suggestionId', new ParseUUIDPipe()) suggestionId: string,
  ) {
    return this.ai.applySuggestion(user.sub, tripId, suggestionId);
  }

  @Post('suggestions/:suggestionId/dismiss')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Dismisses one pending owned suggestion.' })
  dismiss(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Param('suggestionId', new ParseUUIDPipe()) suggestionId: string,
  ) {
    return this.ai.dismissSuggestion(user.sub, tripId, suggestionId);
  }
}
