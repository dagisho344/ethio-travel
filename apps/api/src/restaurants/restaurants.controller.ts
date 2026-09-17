import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
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
  CreateRestaurantMenuDto,
  CreateRestaurantMenuItemDto,
  UpdateRestaurantDetailDto,
  UpdateRestaurantMenuDto,
  UpdateRestaurantMenuItemDto,
} from './dto/restaurant.dto';
import { RestaurantsService } from './restaurants.service';

@ApiTags('my business restaurants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('my/businesses/:businessId/services/:serviceId/restaurant')
export class MyBusinessRestaurantsController {
  constructor(private readonly restaurants: RestaurantsService) {}

  @Get()
  @ApiOkResponse({
    description: 'Restaurant configuration for an authorized business member.',
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
  ) {
    return this.restaurants.findMine(user.sub, businessId, serviceId);
  }

  @Patch()
  @ApiOkResponse({
    description: 'Restaurant details updated by an owner or manager.',
  })
  updateDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Body() dto: UpdateRestaurantDetailDto,
  ) {
    return this.restaurants.updateDetail(user.sub, businessId, serviceId, dto);
  }

  @Get('menus')
  @ApiOkResponse({ description: 'Restaurant menus for an authorized member.' })
  listMenus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
  ) {
    return this.restaurants.listMenus(user.sub, businessId, serviceId);
  }

  @Post('menus')
  @ApiCreatedResponse({ description: 'Restaurant menu created.' })
  createMenu(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Body() dto: CreateRestaurantMenuDto,
  ) {
    return this.restaurants.createMenu(user.sub, businessId, serviceId, dto);
  }

  @Patch('menus/:menuId')
  @ApiOkResponse({ description: 'Restaurant menu updated.' })
  updateMenu(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Param('menuId', new ParseUUIDPipe({ version: '4' })) menuId: string,
    @Body() dto: UpdateRestaurantMenuDto,
  ) {
    return this.restaurants.updateMenu(
      user.sub,
      businessId,
      serviceId,
      menuId,
      dto,
    );
  }

  @Post('menus/:menuId/activate')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Restaurant menu activated.' })
  activateMenu(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Param('menuId', new ParseUUIDPipe({ version: '4' })) menuId: string,
  ) {
    return this.restaurants.setMenuActive(
      user.sub,
      businessId,
      serviceId,
      menuId,
      true,
    );
  }

  @Post('menus/:menuId/deactivate')
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Restaurant menu deactivated without deletion.',
  })
  deactivateMenu(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Param('menuId', new ParseUUIDPipe({ version: '4' })) menuId: string,
  ) {
    return this.restaurants.setMenuActive(
      user.sub,
      businessId,
      serviceId,
      menuId,
      false,
    );
  }

  @Get('menus/:menuId/items')
  @ApiOkResponse({
    description: 'Restaurant menu items for an authorized member.',
  })
  listMenuItems(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Param('menuId', new ParseUUIDPipe({ version: '4' })) menuId: string,
  ) {
    return this.restaurants.listMenuItems(
      user.sub,
      businessId,
      serviceId,
      menuId,
    );
  }

  @Post('menus/:menuId/items')
  @ApiCreatedResponse({ description: 'Restaurant menu item created.' })
  createMenuItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Param('menuId', new ParseUUIDPipe({ version: '4' })) menuId: string,
    @Body() dto: CreateRestaurantMenuItemDto,
  ) {
    return this.restaurants.createMenuItem(
      user.sub,
      businessId,
      serviceId,
      menuId,
      dto,
    );
  }

  @Patch('menus/:menuId/items/:itemId')
  @ApiOkResponse({ description: 'Restaurant menu item updated.' })
  updateMenuItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Param('menuId', new ParseUUIDPipe({ version: '4' })) menuId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Body() dto: UpdateRestaurantMenuItemDto,
  ) {
    return this.restaurants.updateMenuItem(
      user.sub,
      businessId,
      serviceId,
      menuId,
      itemId,
      dto,
    );
  }

  @Post('menus/:menuId/items/:itemId/available')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Restaurant menu item marked available.' })
  markAvailable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Param('menuId', new ParseUUIDPipe({ version: '4' })) menuId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
  ) {
    return this.restaurants.setMenuItemAvailable(
      user.sub,
      businessId,
      serviceId,
      menuId,
      itemId,
      true,
    );
  }

  @Post('menus/:menuId/items/:itemId/unavailable')
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Restaurant menu item marked unavailable without deletion.',
  })
  markUnavailable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Param('menuId', new ParseUUIDPipe({ version: '4' })) menuId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
  ) {
    return this.restaurants.setMenuItemAvailable(
      user.sub,
      businessId,
      serviceId,
      menuId,
      itemId,
      false,
    );
  }
}
