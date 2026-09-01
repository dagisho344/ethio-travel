import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { BusinessMembersService } from './business-members.service';
import {
  CreateBusinessMemberDto,
  UpdateBusinessMemberDto,
} from './dto/business-member.dto';

@ApiTags('my business members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('my/businesses/:businessId/members')
export class BusinessMembersController {
  constructor(private readonly service: BusinessMembersService) {}
  @Get() @ApiOkResponse({ description: 'Business members.' }) findMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
  ) {
    return this.service.findMembers(user.sub, businessId);
  }
  @Post() @ApiCreatedResponse({ description: 'Business member added.' }) create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateBusinessMemberDto,
  ) {
    return this.service.createMember(user.sub, businessId, dto);
  }
  @Patch(':memberId')
  @ApiOkResponse({ description: 'Business member updated.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateBusinessMemberDto,
  ) {
    return this.service.updateMember(user.sub, businessId, memberId, dto);
  }
}
