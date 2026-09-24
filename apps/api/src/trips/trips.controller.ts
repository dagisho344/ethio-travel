import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import {
  CreateTripDto,
  CreateTripItemDto,
  CreateTripPlannedExpenseDto,
  ReorderTripItemsDto,
  TripQueryDto,
  UpdateTripPlannedExpenseDto,
  UpsertTripBudgetDto,
  UpdateTripDayDto,
  UpdateTripDto,
  UpdateTripItemDto,
} from './dto/trip.dto';
import { TripsService } from './trips.service';

@ApiTags('trips')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Post('trips')
  @ApiCreatedResponse({ description: 'Authenticated traveler trip created.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTripDto) {
    return this.trips.create(user.sub, dto);
  }

  @Get('users/me/trips')
  @ApiOkResponse({ description: 'Paginated authenticated traveler trips.' })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TripQueryDto,
  ) {
    return this.trips.findMine(user.sub, query);
  }

  @Get('trips/:id')
  @ApiOkResponse({ description: 'Authenticated traveler trip detail.' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.trips.findOne(user.sub, id);
  }

  @Patch('trips/:id')
  @ApiOkResponse({ description: 'Authenticated traveler trip updated.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTripDto,
  ) {
    return this.trips.update(user.sub, id, dto);
  }

  @Post('trips/:id/archive')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Trip archived without deleting history.' })
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.trips.archive(user.sub, id);
  }

  @Get('trips/:id/budget')
  @ApiOkResponse({ description: 'Owned private trip budget.' })
  budget(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.trips.budget(user.sub, id);
  }

  @Put('trips/:id/budget')
  @ApiOkResponse({ description: 'Owned trip budget created or updated.' })
  upsertBudget(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpsertTripBudgetDto,
  ) {
    return this.trips.upsertBudget(user.sub, id, dto);
  }

  @Delete('trips/:id/budget')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Owned private budget plan removed.' })
  async deleteBudget(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.trips.deleteBudget(user.sub, id);
  }

  @Post('trips/:id/budget/expenses')
  @ApiCreatedResponse({ description: 'Owned planned expense created.' })
  createPlannedExpense(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateTripPlannedExpenseDto,
  ) {
    return this.trips.createPlannedExpense(user.sub, id, dto);
  }

  @Patch('trips/:id/budget/expenses/:expenseId')
  @ApiOkResponse({ description: 'Owned planned expense updated.' })
  updatePlannedExpense(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('expenseId', new ParseUUIDPipe()) expenseId: string,
    @Body() dto: UpdateTripPlannedExpenseDto,
  ) {
    return this.trips.updatePlannedExpense(user.sub, id, expenseId, dto);
  }

  @Delete('trips/:id/budget/expenses/:expenseId')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Owned planned expense removed.' })
  async deletePlannedExpense(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('expenseId', new ParseUUIDPipe()) expenseId: string,
  ): Promise<void> {
    await this.trips.deletePlannedExpense(user.sub, id, expenseId);
  }

  @Get('trips/:id/days')
  @ApiOkResponse({
    description: 'Chronological itinerary days for an owned trip.',
  })
  days(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.trips.days(user.sub, id);
  }

  @Patch('trips/:id/days/:dayId')
  @ApiOkResponse({ description: 'Owned trip-day notes updated.' })
  updateDay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('dayId', new ParseUUIDPipe()) dayId: string,
    @Body() dto: UpdateTripDayDto,
  ) {
    return this.trips.updateDay(user.sub, id, dayId, dto);
  }

  @Post('trips/:id/days/:dayId/items')
  @ApiCreatedResponse({
    description: 'Itinerary item added to an owned trip day.',
  })
  addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('dayId', new ParseUUIDPipe()) dayId: string,
    @Body() dto: CreateTripItemDto,
  ) {
    return this.trips.addItem(user.sub, id, dayId, dto);
  }

  @Post('trips/:id/days/:dayId/items/reorder')
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Owned trip-day items reordered transactionally.',
  })
  reorderItems(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('dayId', new ParseUUIDPipe()) dayId: string,
    @Body() dto: ReorderTripItemsDto,
  ) {
    return this.trips.reorderItems(user.sub, id, dayId, dto);
  }

  @Patch('trips/:id/days/:dayId/items/:itemId')
  @ApiOkResponse({ description: 'Owned itinerary item updated.' })
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('dayId', new ParseUUIDPipe()) dayId: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() dto: UpdateTripItemDto,
  ) {
    return this.trips.updateItem(user.sub, id, dayId, itemId, dto);
  }

  @Delete('trips/:id/days/:dayId/items/:itemId')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Itinerary association removed only.' })
  async removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('dayId', new ParseUUIDPipe()) dayId: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
  ): Promise<void> {
    await this.trips.removeItem(user.sub, id, dayId, itemId);
  }
}
