import {
  Body,
  Controller,
  Get,
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
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ConversationQueryDto,
  MessageQueryDto,
} from './dto/conversation-query.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagingService } from './messaging.service';

@ApiTags('messaging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class MessagingController {
  constructor(private readonly service: MessagingService) {}

  @Post('conversations')
  @ApiCreatedResponse({
    description:
      'Conversation created or returned for an existing booking thread.',
  })
  createConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConversationDto,
  ) {
    return this.service.createConversation(user.sub, dto);
  }

  @Get('conversations')
  @ApiOkResponse({
    description: 'Paginated conversations for the authenticated member.',
  })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ConversationQueryDto,
  ) {
    return this.service.findMine(user.sub, query);
  }

  @Get('conversations/:id')
  @ApiOkResponse({
    description: 'Conversation detail for an authenticated member.',
  })
  findById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findById(user.sub, id);
  }

  @Get('conversations/:id/messages')
  @ApiOkResponse({
    description: 'Paginated messages for an authenticated conversation member.',
  })
  findMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: MessageQueryDto,
  ) {
    return this.service.findMessages(user.sub, id, query);
  }

  @Post('conversations/:id/messages')
  @ApiCreatedResponse({
    description: 'Message sent by an authenticated conversation member.',
  })
  createMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.service.createMessage(user.sub, id, dto);
  }

  @Post('conversations/:id/read')
  @ApiOkResponse({
    description:
      'Marks this conversation read for the authenticated user only.',
  })
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.markRead(user.sub, id);
  }
}
