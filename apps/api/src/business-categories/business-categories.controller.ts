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
import { BusinessCategoriesService } from './business-categories.service';
import { BusinessCategoryQueryDto } from './dto/business-category-query.dto';
import { CreateBusinessCategoryDto } from './dto/create-business-category.dto';
import { UpdateBusinessCategoryDto } from './dto/update-business-category.dto';

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
  create(@Body() dto: CreateBusinessCategoryDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Business category updated.' })
  update(@Param('id') id: string, @Body() dto: UpdateBusinessCategoryDto) {
    return this.service.update(id, dto);
  }
}
