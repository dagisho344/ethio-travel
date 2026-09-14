import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { BusinessOperationsService } from './business-operations.service';
import {
  BusinessReviewQueryDto,
  UpsertBusinessReviewResponseDto,
} from './dto/business-operations.dto';

@ApiTags('business operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('my/businesses/:businessId')
export class BusinessOperationsController {
  constructor(private readonly operations: BusinessOperationsService) {}

  @Get('dashboard')
  @ApiOkResponse({
    description: 'Server-derived business operational dashboard.',
  })
  dashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
  ) {
    return this.operations.dashboard(user.sub, businessId);
  }

  @Get('customers')
  customers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.operations.customers(user.sub, businessId, query);
  }

  @Get('customers/:travelerId')
  customer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('travelerId', new ParseUUIDPipe()) travelerId: string,
  ) {
    return this.operations.customer(user.sub, businessId, travelerId);
  }

  @Get('reviews')
  reviews(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Query() query: BusinessReviewQueryDto,
  ) {
    return this.operations.reviews(user.sub, businessId, query);
  }

  @Post('reviews/:reviewId/response')
  @Patch('reviews/:reviewId/response')
  respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @Body() dto: UpsertBusinessReviewResponseDto,
  ) {
    return this.operations.upsertReviewResponse(
      user.sub,
      businessId,
      reviewId,
      dto,
    );
  }
}
