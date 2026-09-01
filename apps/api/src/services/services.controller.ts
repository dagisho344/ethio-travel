import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { CreateServiceDto } from './dto/create-service.dto';
import { AdminServiceQueryDto, ServiceQueryDto } from './dto/service-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

@ApiTags('services')
@Controller()
export class ServicesController {
  constructor(private readonly service: ServicesService) {}

  @Get('services')
  @ApiOkResponse({ description: 'Paginated public services.' })
  findPublic(@Query() query: ServiceQueryDto) {
    return this.service.findPublic(query);
  }

  @Get('regions/:regionSlug/cities/:citySlug/businesses/:businessSlug/services')
  @ApiOkResponse({ description: 'Paginated public services for a business.' })
  findByBusiness(
    @Param('regionSlug') regionSlug: string,
    @Param('citySlug') citySlug: string,
    @Param('businessSlug') businessSlug: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.findPublicByBusinessSlugs(
      regionSlug,
      citySlug,
      businessSlug,
      query,
    );
  }

  @Get(
    'regions/:regionSlug/cities/:citySlug/businesses/:businessSlug/services/:serviceSlug',
  )
  @ApiOkResponse({
    description: 'Public service by scoped business/service slug.',
  })
  findOne(
    @Param('regionSlug') regionSlug: string,
    @Param('citySlug') citySlug: string,
    @Param('businessSlug') businessSlug: string,
    @Param('serviceSlug') serviceSlug: string,
  ) {
    return this.service.findPublicBySlugs(
      regionSlug,
      citySlug,
      businessSlug,
      serviceSlug,
    );
  }
}

@ApiTags('my business services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('my/businesses/:businessId/services')
export class MyBusinessServicesController {
  constructor(private readonly service: ServicesService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Business service draft created.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateServiceDto,
  ) {
    return this.service.create(user.sub, businessId, dto);
  }

  @Get()
  @ApiOkResponse({
    description: 'Paginated services for an authorized business member.',
  })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.findMine(user.sub, businessId, query);
  }

  @Get(':serviceId')
  @ApiOkResponse({ description: 'Business service workspace detail.' })
  findMineById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('serviceId') serviceId: string,
  ) {
    return this.service.findMineById(user.sub, businessId, serviceId);
  }

  @Patch(':serviceId')
  @ApiOkResponse({
    description: 'Business service updated by owner or manager.',
  })
  updateMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('serviceId') serviceId: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.service.updateMine(user.sub, businessId, serviceId, dto);
  }

  @Post(':serviceId/publish')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Business service published.' })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('serviceId') serviceId: string,
  ) {
    return this.service.publishMine(user.sub, businessId, serviceId);
  }

  @Post(':serviceId/unpublish')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Business service unpublished.' })
  unpublish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('serviceId') serviceId: string,
  ) {
    return this.service.unpublishMine(user.sub, businessId, serviceId);
  }

  @Post(':serviceId/archive')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Business service archived.' })
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('serviceId') serviceId: string,
  ) {
    return this.service.archiveMine(user.sub, businessId, serviceId);
  }
}

@ApiTags('admin services')
@AdminOnly()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/services')
export class AdminServicesController {
  constructor(private readonly service: ServicesService) {}

  @Get()
  @ApiOkResponse({ description: 'Paginated services for administrators.' })
  findAdmin(@Query() query: AdminServiceQueryDto) {
    return this.service.findAdmin(query);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Service by id for administrators.' })
  findAdminById(@Param('id') id: string) {
    return this.service.findAdminById(id);
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Service unpublished by administrator.' })
  unpublish(@Param('id') id: string) {
    return this.service.unpublishAdmin(id);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Service archived by administrator.' })
  archive(@Param('id') id: string) {
    return this.service.archiveAdmin(id);
  }
}
