import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateTripShareDto,
  ResolveTripShareDto,
  UpdateTripShareDto,
} from './dto/trip-share.dto';
import { TripShareService } from './trip-share.service';

const publicShareHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

@ApiTags('trip shares')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trips')
export class TripShareOwnerController {
  constructor(private readonly shares: TripShareService) {}

  @Get(':tripId/share')
  @ApiOkResponse({ description: 'Safe owner-only trip-share metadata.' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
  ) {
    return this.shares.findOwnerShare(user.sub, tripId);
  }

  @Get(':tripId/share/preview')
  @ApiOkResponse({
    description: 'Exact filtered itinerary that would be shared publicly.',
  })
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
  ) {
    return this.shares.preview(user.sub, tripId);
  }

  @Post(':tripId/share')
  @ApiCreatedResponse({
    description: 'Creates one share link and returns its raw secret once.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Body() dto: CreateTripShareDto,
  ) {
    return this.shares.create(user.sub, tripId, dto);
  }

  @Patch(':tripId/share')
  @ApiOkResponse({ description: 'Updates the expiration of an active link.' })
  updateExpiration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Body() dto: UpdateTripShareDto,
  ) {
    return this.shares.updateExpiration(user.sub, tripId, dto);
  }

  @Post(':tripId/share/regenerate')
  @ApiOkResponse({
    description: 'Rotates a share secret and returns the replacement once.',
  })
  regenerate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Body() dto: CreateTripShareDto,
  ) {
    return this.shares.regenerate(user.sub, tripId, dto);
  }

  @Post(':tripId/share/revoke')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Revokes a trip share idempotently.' })
  async revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
  ): Promise<void> {
    await this.shares.revoke(user.sub, tripId);
  }
}

@ApiTags('public trip shares')
@Controller('trip-shares')
export class PublicTripShareController {
  constructor(private readonly shares: TripShareService) {}

  @Post('resolve')
  @HttpCode(200)
  @Header('Cache-Control', publicShareHeaders['Cache-Control'])
  @Header('Pragma', publicShareHeaders.Pragma)
  @Header('Referrer-Policy', publicShareHeaders['Referrer-Policy'])
  @Header('X-Robots-Tag', publicShareHeaders['X-Robots-Tag'])
  @ApiOkResponse({ description: 'Safe read-only shared itinerary.' })
  resolve(@Body() dto: ResolveTripShareDto, @Req() request: Request) {
    return this.shares.resolve(dto.token, request.socket.remoteAddress);
  }
}
