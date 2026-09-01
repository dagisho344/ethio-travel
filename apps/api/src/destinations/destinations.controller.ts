import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { AdminOnly } from '../common/utils/admin-only.decorator';
import { DestinationsService } from './destinations.service';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { DestinationQueryDto } from './dto/destination-query.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';

@ApiTags('destinations')
@Controller()
export class DestinationsController {
  constructor(private readonly destinationsService: DestinationsService) {}

  @Get('destinations')
  @ApiOkResponse({
    description:
      'Paginated published destinations with active city and region.',
  })
  findAll(@Query() query: PaginationQueryDto) {
    return this.destinationsService.findPublic(query);
  }

  @Get('regions/:regionSlug/cities/:citySlug/destinations')
  @ApiOkResponse({
    description: 'Paginated published destinations for an active city.',
  })
  findByCity(
    @Param('regionSlug') regionSlug: string,
    @Param('citySlug') citySlug: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.destinationsService.findPublicByCitySlugs(
      regionSlug,
      citySlug,
      query,
    );
  }

  @Get('regions/:regionSlug/cities/:citySlug/destinations/:destinationSlug')
  @ApiOkResponse({ description: 'Published destination by scoped slug chain.' })
  findOne(
    @Param('regionSlug') regionSlug: string,
    @Param('citySlug') citySlug: string,
    @Param('destinationSlug') destinationSlug: string,
  ) {
    return this.destinationsService.findPublicBySlugs(
      regionSlug,
      citySlug,
      destinationSlug,
    );
  }
}

@ApiTags('admin destinations')
@AdminOnly()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/destinations')
export class AdminDestinationsController {
  constructor(private readonly destinationsService: DestinationsService) {}

  @Get()
  @ApiOkResponse({ description: 'Paginated destinations for administrators.' })
  findAll(@Query() query: DestinationQueryDto) {
    return this.destinationsService.findAdmin(query);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Destination by id for administrators.' })
  findOne(@Param('id') id: string) {
    return this.destinationsService.findAdminById(id);
  }

  @Post()
  @ApiCreatedResponse({ description: 'Destination created.' })
  create(@Body() dto: CreateDestinationDto) {
    return this.destinationsService.create(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Destination updated.' })
  update(@Param('id') id: string, @Body() dto: UpdateDestinationDto) {
    return this.destinationsService.update(id, dto);
  }
}
