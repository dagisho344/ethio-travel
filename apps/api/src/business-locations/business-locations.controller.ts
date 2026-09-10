import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import {
  CreateBusinessLocationDto,
  ReplaceOperatingHoursDto,
  UpdateBusinessLocationDto,
} from './dto/business-location.dto';
import { BusinessLocationsService } from './business-locations.service';

@ApiTags('my business locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('my/businesses/:businessId/locations')
export class BusinessLocationsController {
  constructor(private readonly service: BusinessLocationsService) {}

  @Get()
  @ApiOkResponse({ description: 'Locations for an active business member.' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
  ) {
    return this.service.list(user.sub, businessId);
  }

  @Post()
  @ApiCreatedResponse({
    description: 'Business branch created by owner or manager.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateBusinessLocationDto,
  ) {
    return this.service.create(user.sub, businessId, dto);
  }

  @Get(':locationId')
  @ApiOkResponse({
    description: 'Business location for an active business member.',
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.service.findOne(user.sub, businessId, locationId);
  }

  @Patch(':locationId')
  @ApiOkResponse({
    description: 'Business branch updated by owner or manager.',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('locationId') locationId: string,
    @Body() dto: UpdateBusinessLocationDto,
  ) {
    return this.service.update(user.sub, businessId, locationId, dto);
  }

  @Post(':locationId/make-primary')
  @ApiOkResponse({
    description: 'Atomically sets an active branch as primary.',
  })
  makePrimary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.service.makePrimary(user.sub, businessId, locationId);
  }

  @Post(':locationId/archive')
  @ApiOkResponse({ description: 'Archives a non-primary business branch.' })
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.service.archive(user.sub, businessId, locationId);
  }

  @Get(':locationId/hours')
  @ApiOkResponse({
    description: 'Weekly local operating hours for a business branch.',
  })
  listHours(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.service.listHours(user.sub, businessId, locationId);
  }

  @Put(':locationId/hours')
  @ApiOkResponse({
    description: 'Transactionally replaces weekly branch operating hours.',
  })
  replaceHours(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('locationId') locationId: string,
    @Body() dto: ReplaceOperatingHoursDto,
  ) {
    return this.service.replaceHours(user.sub, businessId, locationId, dto);
  }
}
