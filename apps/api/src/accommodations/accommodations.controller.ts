import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { AccommodationService } from './accommodations.service';
import {
  CreateRoomTypeDto,
  UpdateAccommodationDetailDto,
  UpdateRoomTypeDto,
} from './dto/accommodation.dto';

@ApiTags('my business accommodation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('my/businesses/:businessId/services/:serviceId/accommodation')
export class MyBusinessAccommodationController {
  constructor(private readonly accommodations: AccommodationService) {}

  @Get()
  @ApiOkResponse({
    description: 'Accommodation configuration for a ROOM service.',
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
  ) {
    return this.accommodations.findMine(user.sub, businessId, serviceId);
  }

  @Patch()
  @ApiOkResponse({
    description: 'Accommodation details updated by an owner or manager.',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Body() dto: UpdateAccommodationDetailDto,
  ) {
    return this.accommodations.updateDetail(
      user.sub,
      businessId,
      serviceId,
      dto,
    );
  }

  @Get('rooms')
  @ApiOkResponse({
    description: 'Room types for an authorized business member.',
  })
  listRooms(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
  ) {
    return this.accommodations.listRooms(user.sub, businessId, serviceId);
  }

  @Post('rooms')
  @ApiCreatedResponse({
    description: 'Room type created by an owner or manager.',
  })
  createRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Body() dto: CreateRoomTypeDto,
  ) {
    return this.accommodations.createRoom(user.sub, businessId, serviceId, dto);
  }

  @Patch('rooms/:roomTypeId')
  @ApiOkResponse({ description: 'Room type updated by an owner or manager.' })
  updateRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Param('roomTypeId', new ParseUUIDPipe({ version: '4' }))
    roomTypeId: string,
    @Body() dto: UpdateRoomTypeDto,
  ) {
    return this.accommodations.updateRoom(
      user.sub,
      businessId,
      serviceId,
      roomTypeId,
      dto,
    );
  }

  @Post('rooms/:roomTypeId/activate')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Room type activated.' })
  activateRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Param('roomTypeId', new ParseUUIDPipe({ version: '4' }))
    roomTypeId: string,
  ) {
    return this.accommodations.setRoomActive(
      user.sub,
      businessId,
      serviceId,
      roomTypeId,
      true,
    );
  }

  @Post('rooms/:roomTypeId/deactivate')
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Room type deactivated without deleting history.',
  })
  deactivateRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Param('roomTypeId', new ParseUUIDPipe({ version: '4' }))
    roomTypeId: string,
  ) {
    return this.accommodations.setRoomActive(
      user.sub,
      businessId,
      serviceId,
      roomTypeId,
      false,
    );
  }
}
