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
import { AdminOnly } from '../common/utils/admin-only.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CreateRegionDto } from './dto/create-region.dto';
import { RegionQueryDto } from './dto/region-query.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { RegionsService } from './regions.service';

@ApiTags('regions')
@Controller('regions')
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) {}

  @Get()
  @ApiOkResponse({ description: 'Paginated active regions.' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.regionsService.findPublic(query);
  }

  @Get(':regionSlug')
  @ApiOkResponse({ description: 'Active region by slug.' })
  findOne(@Param('regionSlug') regionSlug: string) {
    return this.regionsService.findPublicBySlug(regionSlug);
  }
}

@ApiTags('admin regions')
@AdminOnly()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/regions')
export class AdminRegionsController {
  constructor(private readonly regionsService: RegionsService) {}

  @Get()
  @ApiOkResponse({ description: 'Paginated regions for administrators.' })
  findAll(@Query() query: RegionQueryDto) {
    return this.regionsService.findAdmin(query);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Region by id for administrators.' })
  findOne(@Param('id') id: string) {
    return this.regionsService.findAdminById(id);
  }

  @Post()
  @ApiCreatedResponse({ description: 'Region created.' })
  create(@Body() dto: CreateRegionDto) {
    return this.regionsService.create(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Region updated.' })
  update(@Param('id') id: string, @Body() dto: UpdateRegionDto) {
    return this.regionsService.update(id, dto);
  }
}
