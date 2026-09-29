import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { EditorialLocale } from '@prisma/client';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminOnly } from '../common/utils/admin-only.decorator';
import {
  PublicRegionQueryDto,
  RegionLocaleQueryDto,
} from './dto/public-region-query.dto';
import {
  RegionTranslationActionDto,
  UpsertRegionTranslationDto,
} from './dto/upsert-region-translation.dto';
import { CreateRegionDto } from './dto/create-region.dto';
import { RegionQueryDto } from './dto/region-query.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { RegionsService } from './regions.service';
import { RegionTranslationBodyPipe } from './region-translation-body.pipe';

function auditContext(request: Request) {
  return {
    correlationId: typeof request.id === 'string' ? request.id : undefined,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  };
}

@ApiTags('regions')
@Controller('regions')
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) {}

  @Get()
  @ApiOkResponse({ description: 'Paginated active regions.' })
  findAll(@Query() query: PublicRegionQueryDto) {
    return this.regionsService.findPublic(query);
  }

  @Get(':regionSlug')
  @ApiOkResponse({ description: 'Active region by slug.' })
  findOne(
    @Param('regionSlug') regionSlug: string,
    @Query() query: RegionLocaleQueryDto,
  ) {
    return this.regionsService.findPublicBySlug(regionSlug, query.locale);
  }
}

@ApiTags('admin regions')
@ApiBearerAuth()
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

  @Get(':id/translations/:locale')
  @ApiOkResponse({
    description: 'Region editorial translation for administrators.',
  })
  findTranslation(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('locale', new ParseEnumPipe(EditorialLocale))
    locale: EditorialLocale,
  ) {
    return this.regionsService.findTranslation(id, locale);
  }

  @Put(':id/translations/:locale')
  @ApiOkResponse({
    description: 'Saves an unpublished Region translation draft.',
  })
  saveTranslation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('locale', new ParseEnumPipe(EditorialLocale))
    locale: EditorialLocale,
    @Body(new RegionTranslationBodyPipe()) dto: UpsertRegionTranslationDto,
    @Req() request: Request,
  ) {
    return this.regionsService.saveTranslation(
      id,
      locale,
      user.sub,
      dto,
      auditContext(request),
    );
  }

  @Post(':id/translations/:locale/publish')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Publishes a complete Region translation.' })
  publishTranslation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('locale', new ParseEnumPipe(EditorialLocale))
    locale: EditorialLocale,
    @Body(new RegionTranslationBodyPipe()) _body: RegionTranslationActionDto,
    @Req() request: Request,
  ) {
    return this.regionsService.publishTranslation(
      id,
      locale,
      user.sub,
      auditContext(request),
    );
  }

  @Post(':id/translations/:locale/unpublish')
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Unpublishes a Region translation, preserving draft text.',
  })
  unpublishTranslation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('locale', new ParseEnumPipe(EditorialLocale))
    locale: EditorialLocale,
    @Body(new RegionTranslationBodyPipe()) _body: RegionTranslationActionDto,
    @Req() request: Request,
  ) {
    return this.regionsService.unpublishTranslation(
      id,
      locale,
      user.sub,
      auditContext(request),
    );
  }

  @Post()
  @ApiCreatedResponse({ description: 'Region created.' })
  create(@Body() dto: CreateRegionDto) {
    return this.regionsService.create(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Region updated.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRegionDto,
    @Req() request: Request,
  ) {
    return this.regionsService.update(id, dto, user.sub, auditContext(request));
  }
}
