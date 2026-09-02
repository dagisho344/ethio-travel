import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { FavoriteQueryDto } from './dto/favorite-query.dto';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class FavoritesController {
  constructor(private readonly service: FavoritesService) {}

  @Post('favorites')
  @ApiCreatedResponse({
    description: 'Favorite created for the authenticated user.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFavoriteDto,
  ) {
    return this.service.create(user.sub, dto);
  }

  @Get('users/me/favorites')
  @ApiOkResponse({
    description: 'Paginated favorites for the authenticated user.',
  })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FavoriteQueryDto,
  ) {
    return this.service.findMine(user.sub, query);
  }

  @Delete('favorites/:id')
  @HttpCode(204)
  @ApiNoContentResponse({
    description: 'Favorite removed for the authenticated user.',
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.remove(user.sub, id);
  }
}
