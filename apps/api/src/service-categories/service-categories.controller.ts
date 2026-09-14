import {
  Body,
  Controller,
  Get,
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
import { AdminOnly } from '../common/utils/admin-only.decorator';
import { ServiceCategoriesService } from './service-categories.service';
import { ServiceCategoryQueryDto } from './dto/service-category-query.dto';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';

function auditContext(request: Request) {
  return {
    correlationId: typeof request.id === 'string' ? request.id : undefined,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  };
}

@ApiTags('service categories')
@Controller('service-categories')
export class ServiceCategoriesController {
  constructor(private readonly service: ServiceCategoriesService) {}

  @Get()
  @ApiOkResponse({ description: 'Paginated active service categories.' })
  findPublic(@Query() query: ServiceCategoryQueryDto) {
    return this.service.findPublic(query);
  }
}

@ApiTags('admin service categories')
@ApiBearerAuth()
@AdminOnly()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/service-categories')
export class AdminServiceCategoriesController {
  constructor(private readonly service: ServiceCategoriesService) {}

  @Get()
  @ApiOkResponse({
    description: 'Paginated service categories for administrators.',
  })
  findAdmin(@Query() query: ServiceCategoryQueryDto) {
    return this.service.findAdmin(query);
  }

  @Post()
  @ApiCreatedResponse({ description: 'Service category created.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateServiceCategoryDto,
    @Req() request: Request,
  ) {
    return this.service.createAdmin(user.sub, dto, auditContext(request));
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Service category updated.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateServiceCategoryDto,
    @Req() request: Request,
  ) {
    return this.service.updateAdmin(id, user.sub, dto, auditContext(request));
  }
}
