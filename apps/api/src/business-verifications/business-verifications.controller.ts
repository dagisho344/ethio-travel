import {
  Body,
  Controller,
  HttpCode,
  Get,
  Param,
  Post,
  Query,
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
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminOnly } from '../common/utils/admin-only.decorator';
import { BusinessVerificationsService } from './business-verifications.service';
import {
  ApproveBusinessVerificationDto,
  RejectBusinessVerificationDto,
} from './dto/business-verification.dto';
import { BusinessVerificationQueryDto } from './dto/business-verification-query.dto';

@ApiTags('my business verifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('my/businesses/:businessId/verifications')
export class MyBusinessVerificationsController {
  constructor(private readonly service: BusinessVerificationsService) {}
  @Post()
  @ApiCreatedResponse({
    description: 'Verification submitted without documents.',
  })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
  ) {
    return this.service.submit(user.sub, businessId);
  }
  @Get()
  @ApiOkResponse({ description: 'Own business verification history.' })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Query() query: BusinessVerificationQueryDto,
  ) {
    return this.service.findMine(user.sub, businessId, query);
  }
  @Get(':verificationId')
  @ApiOkResponse({ description: 'Own business verification detail.' })
  findMineById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('verificationId') verificationId: string,
  ) {
    return this.service.findMineById(user.sub, businessId, verificationId);
  }
}

@ApiTags('admin business verifications')
@AdminOnly()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/business-verifications')
export class AdminBusinessVerificationsController {
  constructor(private readonly service: BusinessVerificationsService) {}
  @Get()
  @ApiOkResponse({ description: 'Business verifications for administrators.' })
  findAdmin(@Query() query: BusinessVerificationQueryDto) {
    return this.service.findAdmin(query);
  }
  @Get(':id')
  @ApiOkResponse({ description: 'Business verification by id.' })
  findAdminById(@Param('id') id: string) {
    return this.service.findAdminById(id);
  }
  @Post(':id/approve')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Approve pending business verification.' })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ApproveBusinessVerificationDto,
  ) {
    return this.service.approve(user, id, dto);
  }
  @Post(':id/reject')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Reject pending business verification.' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectBusinessVerificationDto,
  ) {
    return this.service.reject(user, id, dto);
  }
}
