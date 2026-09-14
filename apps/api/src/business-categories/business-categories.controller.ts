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
import { BusinessCategoriesService } from './business-categories.service';
import { BusinessCategoryQueryDto } from './dto/business-category-query.dto';
import { CreateBusinessCategoryDto } from './dto/create-business-category.dto';
import { UpdateBusinessCategoryDto } from './dto/update-business-category.dto';

function auditContext(request: Request) {
  return {
    correlationId: typeof request.id === 'string' ? request.id : undefined,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  };
}

@ApiTags('business categories')
@Controller('business-categories')
export class BusinessCategoriesController {
  constructor(private readonly service: BusinessCategoriesService) {}

  @Get()
  @ApiOkResponse({ description: 'Paginated active business categories.' })
  findPublic(@Query() query: BusinessCategoryQueryDto) {
    return this.service.findPublic(query);
  }
}

@ApiTags('admin business categories')
@ApiBearerAuth()
@AdminOnly()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/business-categories')
export class AdminBusinessCategoriesController {
  constructor(private readonly service: BusinessCategoriesService) {}

  @Get()
  @ApiOkResponse({
    description: 'Paginated business categories for administrators.',
  })
  findAdmin(@Query() query: BusinessCategoryQueryDto) {
    return this.service.findAdmin(query);
  }

  @Post()
  @ApiCreatedResponse({ description: 'Business category created.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBusinessCategoryDto,
    @Req() request: Request,
  ) {
    return this.service.createAdmin(user.sub, dto, auditContext(request));
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Business category updated.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBusinessCategoryDto,
    @Req() request: Request,
  ) {
    return this.service.updateAdmin(id, user.sub, dto, auditContext(request));
  }
}
