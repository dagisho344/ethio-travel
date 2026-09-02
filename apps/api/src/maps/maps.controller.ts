import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { MapPlacesQueryDto } from './dto/map-places-query.dto';
import { MapsService } from './maps.service';

@ApiTags('maps')
@Controller('map')
export class MapsController {
  constructor(private readonly service: MapsService) {}

  @Get('places')
  @ApiOkResponse({
    description: 'Lightweight public map markers within a bounding box.',
  })
  findPlaces(@Query() query: MapPlacesQueryDto) {
    return this.service.findPlaces(query);
  }
}
