import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { AdminOnly } from '../common/utils/admin-only.decorator';
import { DestinationsService } from './destinations.service';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { DestinationQueryDto } from './dto/destination-query.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';

function auditContext(request: Request) {
  return {
    correlationId: typeof request.id === 'string' ? request.id : undefined,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  };
}

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
@ApiBearerAuth()
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
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDestinationDto,
    @Req() request: Request,
  ) {
    return this.destinationsService.createAdmin(
      user.sub,
      dto,
      auditContext(request),
    );
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Destination updated.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDestinationDto,
    @Req() request: Request,
  ) {
    return this.destinationsService.updateAdmin(
      id,
      user.sub,
      dto,
      auditContext(request),
    );
  }

  @Post(':id/publish')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Publishes an eligible destination.' })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: Request,
  ) {
    return this.destinationsService.publish(
      id,
      user.sub,
      auditContext(request),
    );
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Removes a destination from public discovery.',
  })
  unpublish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: Request,
  ) {
    return this.destinationsService.unpublish(
      id,
      user.sub,
      auditContext(request),
    );
  }
}
