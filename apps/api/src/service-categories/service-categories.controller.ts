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
import { ServiceCategoriesService } from './service-categories.service';
import { ServiceCategoryQueryDto } from './dto/service-category-query.dto';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';

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
  create(@Body() dto: CreateServiceCategoryDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Service category updated.' })
  update(@Param('id') id: string, @Body() dto: UpdateServiceCategoryDto) {
    return this.service.update(id, dto);
  }
}
