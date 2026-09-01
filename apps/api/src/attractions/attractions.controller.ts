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
import { AttractionsService } from './attractions.service';
import { AttractionQueryDto } from './dto/attraction-query.dto';
import { CreateAttractionDto } from './dto/create-attraction.dto';
import { UpdateAttractionDto } from './dto/update-attraction.dto';

@ApiTags('attractions')
@Controller()
export class AttractionsController {
  constructor(private readonly attractionsService: AttractionsService) {}

  @Get('attractions')
  @ApiOkResponse({
    description: 'Paginated published attractions with public parent chain.',
  })
  findAll(@Query() query: AttractionQueryDto) {
    return this.attractionsService.findPublic(query);
  }

  @Get(
    'regions/:regionSlug/cities/:citySlug/destinations/:destinationSlug/attractions',
  )
  @ApiOkResponse({
    description: 'Paginated published attractions for a published destination.',
  })
  findByDestination(
    @Param('regionSlug') regionSlug: string,
    @Param('citySlug') citySlug: string,
    @Param('destinationSlug') destinationSlug: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.attractionsService.findPublicByDestinationSlugs(
      regionSlug,
      citySlug,
      destinationSlug,
      query,
    );
  }

  @Get(
    'regions/:regionSlug/cities/:citySlug/destinations/:destinationSlug/attractions/:attractionSlug',
  )
  @ApiOkResponse({ description: 'Published attraction by scoped slug chain.' })
  findOne(
    @Param('regionSlug') regionSlug: string,
    @Param('citySlug') citySlug: string,
    @Param('destinationSlug') destinationSlug: string,
    @Param('attractionSlug') attractionSlug: string,
  ) {
    return this.attractionsService.findPublicBySlugs(
      regionSlug,
      citySlug,
      destinationSlug,
      attractionSlug,
    );
  }
}

@ApiTags('admin attractions')
@AdminOnly()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/attractions')
export class AdminAttractionsController {
  constructor(private readonly attractionsService: AttractionsService) {}

  @Get()
  @ApiOkResponse({ description: 'Paginated attractions for administrators.' })
  findAll(@Query() query: AttractionQueryDto) {
    return this.attractionsService.findAdmin(query);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Attraction by id for administrators.' })
  findOne(@Param('id') id: string) {
    return this.attractionsService.findAdminById(id);
  }

  @Post()
  @ApiCreatedResponse({ description: 'Attraction created.' })
  create(@Body() dto: CreateAttractionDto) {
    return this.attractionsService.create(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Attraction updated.' })
  update(@Param('id') id: string, @Body() dto: UpdateAttractionDto) {
    return this.attractionsService.update(id, dto);
  }
}
