import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessMediaService } from './business-media.service';
import {
  ReorderBusinessMediaDto,
  UpdateBusinessMediaDto,
  UploadBusinessMediaDto,
} from './dto/business-media.dto';

@ApiTags('my business media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('my/businesses/:businessId/media')
export class BusinessMediaController {
  constructor(private readonly service: BusinessMediaService) {}
  @Get()
  @ApiOkResponse({ description: 'Business media for an active member.' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
  ) {
    return this.service.list(user.sub, businessId);
  }
  @Post('uploads')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadBusinessMediaDto })
  @ApiCreatedResponse({
    description: 'Validated image uploaded and finalized.',
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: UploadBusinessMediaDto,
    @UploadedFile()
    file: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },
  ) {
    return this.service.upload(user.sub, businessId, dto, file);
  }
  @Patch(':mediaId') update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('mediaId') mediaId: string,
    @Body() dto: UpdateBusinessMediaDto,
  ) {
    return this.service.update(user.sub, businessId, mediaId, dto);
  }
  @Post(':mediaId/archive') archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.service.archive(user.sub, businessId, mediaId);
  }
  @Post('reorder') reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: ReorderBusinessMediaDto,
  ) {
    return this.service.reorder(user.sub, businessId, dto);
  }
}
