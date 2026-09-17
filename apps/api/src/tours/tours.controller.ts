import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
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
  CreateTourItineraryItemDto,
  UpdateTourDetailDto,
  UpdateTourItineraryItemDto,
} from './dto/tour.dto';
import { ToursService } from './tours.service';

@ApiTags('my business tours')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('my/businesses/:businessId/services/:serviceId/tour')
export class MyBusinessToursController {
  constructor(private readonly tours: ToursService) {}

  @Get()
  @ApiOkResponse({
    description: 'Tour configuration for an authorized member.',
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
  ) {
    return this.tours.findMine(user.sub, businessId, serviceId);
  }

  @Patch()
  @ApiOkResponse({
    description: 'Tour details updated by an owner or manager.',
  })
  updateDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Body() dto: UpdateTourDetailDto,
  ) {
    return this.tours.updateDetail(user.sub, businessId, serviceId, dto);
  }

  @Get('itinerary')
  @ApiOkResponse({ description: 'Tour itinerary for an authorized member.' })
  listItinerary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
  ) {
    return this.tours.listItinerary(user.sub, businessId, serviceId);
  }

  @Post('itinerary')
  @ApiCreatedResponse({ description: 'Tour itinerary item created.' })
  createItineraryItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Body() dto: CreateTourItineraryItemDto,
  ) {
    return this.tours.createItineraryItem(user.sub, businessId, serviceId, dto);
  }

  @Patch('itinerary/:itemId')
  @ApiOkResponse({ description: 'Tour itinerary item updated.' })
  updateItineraryItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Body() dto: UpdateTourItineraryItemDto,
  ) {
    return this.tours.updateItineraryItem(
      user.sub,
      businessId,
      serviceId,
      itemId,
      dto,
    );
  }
}
