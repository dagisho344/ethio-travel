import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminOnly } from '../common/utils/admin-only.decorator';
import { CreateReviewDto } from './dto/create-review.dto';
import {
  AdminReviewQueryDto,
  MyReviewQueryDto,
  PublicReviewQueryDto,
  ReviewSummaryQueryDto,
} from './dto/review-query.dto';
import { ReviewModerationNoteDto } from './dto/review-moderation.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @Get('reviews')
  @ApiOkResponse({
    description: 'Paginated public published reviews for a target.',
  })
  findPublic(@Query() query: PublicReviewQueryDto) {
    return this.service.findPublic(query);
  }

  @Get('reviews/summary')
  @ApiOkResponse({ description: 'Published review summary for a target.' })
  summary(@Query() query: ReviewSummaryQueryDto) {
    return this.service.summary(query);
  }

  @Post('reviews')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiCreatedResponse({ description: 'Review submitted for moderation.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReviewDto) {
    return this.service.create(user.sub, dto);
  }

  @Get('users/me/reviews')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({
    description: 'Paginated reviews authored by the authenticated user.',
  })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MyReviewQueryDto,
  ) {
    return this.service.findMine(user.sub, query);
  }

  @Patch('reviews/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({
    description: 'Review edited and resubmitted for moderation.',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.service.update(user.sub, id, dto);
  }
}

@ApiTags('admin reviews')
@AdminOnly()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @Get()
  @ApiOkResponse({ description: 'Paginated review moderation queue.' })
  findAdmin(@Query() query: AdminReviewQueryDto) {
    return this.service.findAdmin(query);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Review moderation detail.' })
  findAdminById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findAdminById(id);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Publish a pending review.' })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.publish(id, user.sub);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Reject a pending review.' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReviewModerationNoteDto,
  ) {
    return this.service.reject(id, user.sub, dto.moderationNote);
  }

  @Post(':id/hide')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Hide a published review.' })
  hide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReviewModerationNoteDto,
  ) {
    return this.service.hide(id, user.sub, dto.moderationNote);
  }
}
