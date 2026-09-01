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
import { CitiesService } from './cities.service';
import { CityQueryDto } from './dto/city-query.dto';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';

@ApiTags('cities')
@Controller()
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Get('cities')
  @ApiOkResponse({
    description: 'Paginated active cities with active regions.',
  })
  findAll(@Query() query: PaginationQueryDto) {
    return this.citiesService.findPublic(query);
  }

  @Get('regions/:regionSlug/cities')
  @ApiOkResponse({
    description: 'Paginated active cities for an active region.',
  })
  findByRegion(
    @Param('regionSlug') regionSlug: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.citiesService.findPublicByRegion(regionSlug, query);
  }

  @Get('regions/:regionSlug/cities/:citySlug')
  @ApiOkResponse({ description: 'Active city by scoped slug.' })
  findOne(
    @Param('regionSlug') regionSlug: string,
    @Param('citySlug') citySlug: string,
  ) {
    return this.citiesService.findPublicBySlugs(regionSlug, citySlug);
  }
}

@ApiTags('admin cities')
@AdminOnly()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/cities')
export class AdminCitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Get()
  @ApiOkResponse({ description: 'Paginated cities for administrators.' })
  findAll(@Query() query: CityQueryDto) {
    return this.citiesService.findAdmin(query);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'City by id for administrators.' })
  findOne(@Param('id') id: string) {
    return this.citiesService.findAdminById(id);
  }

  @Post()
  @ApiCreatedResponse({ description: 'City created.' })
  create(@Body() dto: CreateCityDto) {
    return this.citiesService.create(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'City updated.' })
  update(@Param('id') id: string, @Body() dto: UpdateCityDto) {
    return this.citiesService.update(id, dto);
  }
}
