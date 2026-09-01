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
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { AdminOnly } from '../common/utils/admin-only.decorator';
import { AdminUpdateBusinessDto } from './dto/admin-update-business.dto';
import {
  AdminBusinessQueryDto,
  BusinessQueryDto,
} from './dto/business-query.dto';
import { CreateBusinessDto } from './dto/create-business.dto';
import { OwnerUpdateBusinessDto } from './dto/update-business.dto';
import { BusinessesService } from './businesses.service';

@ApiTags('businesses')
@Controller()
export class BusinessesController {
  constructor(private readonly service: BusinessesService) {}

  @Get('businesses')
  @ApiOkResponse({ description: 'Paginated public businesses.' })
  findPublic(@Query() query: BusinessQueryDto) {
    return this.service.findPublic(query);
  }

  @Get('regions/:regionSlug/cities/:citySlug/businesses')
  @ApiOkResponse({ description: 'Paginated public businesses by city.' })
  findByCity(
    @Param('regionSlug') regionSlug: string,
    @Param('citySlug') citySlug: string,
    @Query() query: BusinessQueryDto,
  ) {
    return this.service.findPublic({ ...query, regionSlug, citySlug });
  }

  @Get('regions/:regionSlug/cities/:citySlug/businesses/:businessSlug')
  @ApiOkResponse({ description: 'Public business by scoped slug.' })
  findOne(
    @Param('regionSlug') regionSlug: string,
    @Param('citySlug') citySlug: string,
    @Param('businessSlug') businessSlug: string,
  ) {
    return this.service.findPublicBySlugs(regionSlug, citySlug, businessSlug);
  }

  @Get(
    'regions/:regionSlug/cities/:citySlug/destinations/:destinationSlug/businesses',
  )
  @ApiOkResponse({ description: 'Paginated public businesses by destination.' })
  findByDestination(
    @Param('regionSlug') regionSlug: string,
    @Param('citySlug') citySlug: string,
    @Param('destinationSlug') destinationSlug: string,
    @Query() query: BusinessQueryDto,
  ) {
    return this.service.findPublic({
      ...query,
      regionSlug,
      citySlug,
      destinationSlug,
    });
  }

  @Post('businesses')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiCreatedResponse({ description: 'Business draft created.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBusinessDto,
  ) {
    return this.service.create(user.sub, dto);
  }
}

@ApiTags('my businesses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('my/businesses')
export class MyBusinessesController {
  constructor(private readonly service: BusinessesService) {}

  @Get()
  @ApiOkResponse({
    description: 'Paginated businesses where requester is an active member.',
  })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.findMine(user.sub, query);
  }

  @Get(':businessId')
  @ApiOkResponse({ description: 'Business workspace detail.' })
  findMineById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
  ) {
    return this.service.findMineById(user.sub, businessId);
  }

  @Patch(':businessId')
  @ApiOkResponse({
    description: 'Business profile updated by owner or manager.',
  })
  updateMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: OwnerUpdateBusinessDto,
  ) {
    return this.service.updateMine(user.sub, businessId, dto);
  }
}

@ApiTags('admin businesses')
@AdminOnly()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/businesses')
export class AdminBusinessesController {
  constructor(private readonly service: BusinessesService) {}

  @Get()
  @ApiOkResponse({ description: 'Paginated businesses for administrators.' })
  findAdmin(@Query() query: AdminBusinessQueryDto) {
    return this.service.findAdmin(query);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Business by id for administrators.' })
  findAdminById(@Param('id') id: string) {
    return this.service.findAdminById(id);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Business updated by administrator.' })
  updateAdmin(@Param('id') id: string, @Body() dto: AdminUpdateBusinessDto) {
    return this.service.updateAdmin(id, dto);
  }
}
