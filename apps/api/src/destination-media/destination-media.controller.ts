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
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminOnly } from '../common/utils/admin-only.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import {
  DestinationMediaService,
  DestinationImageFile,
} from './destination-media.service';
import {
  ReorderDestinationMediaDto,
  UpdateDestinationMediaDto,
  UploadDestinationMediaDto,
  DESTINATION_MEDIA_ROLES,
} from './dto/destination-media.dto';

function auditContext(request: Request) {
  return {
    correlationId: typeof request.id === 'string' ? request.id : undefined,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  };
}

@ApiTags('admin destination media')
@ApiBearerAuth()
@AdminOnly()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/destinations/:destinationId/media')
export class DestinationMediaController {
  constructor(private readonly media: DestinationMediaService) {}

  @Get()
  @ApiOkResponse({
    description: 'Paginated destination image media for administrators.',
  })
  list(
    @Param('destinationId', new ParseUUIDPipe()) destinationId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.media.list(destinationId, query);
  }

  @Post('uploads')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'role'],
      properties: {
        file: { type: 'string', format: 'binary' },
        role: { type: 'string', enum: [...DESTINATION_MEDIA_ROLES] },
        altText: { type: 'string', maxLength: 240 },
        caption: { type: 'string', maxLength: 500 },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Validated destination image uploaded.' })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('destinationId', new ParseUUIDPipe()) destinationId: string,
    @Body() dto: UploadDestinationMediaDto,
    @UploadedFile() file: DestinationImageFile,
    @Req() request: Request,
  ) {
    return this.media.upload(
      destinationId,
      user.sub,
      dto,
      file,
      auditContext(request),
    );
  }

  @Get(':mediaId/content')
  @ApiOkResponse({ description: 'Authenticated Admin image preview.' })
  async content(
    @Param('destinationId', new ParseUUIDPipe()) destinationId: string,
    @Param('mediaId', new ParseUUIDPipe()) mediaId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const image = await this.media.readAdminImage(destinationId, mediaId);
    response.setHeader('Content-Type', image.mimeType);
    response.setHeader('Content-Length', String(image.body.length));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(image.body);
  }

  @Patch(':mediaId')
  @ApiOkResponse({
    description: 'Updates destination image editorial metadata.',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('destinationId', new ParseUUIDPipe()) destinationId: string,
    @Param('mediaId', new ParseUUIDPipe()) mediaId: string,
    @Body() dto: UpdateDestinationMediaDto,
    @Req() request: Request,
  ) {
    return this.media.update(
      destinationId,
      mediaId,
      user.sub,
      dto,
      auditContext(request),
    );
  }

  @Post(':mediaId/archive')
  @ApiOkResponse({ description: 'Archives a destination image.' })
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('destinationId', new ParseUUIDPipe()) destinationId: string,
    @Param('mediaId', new ParseUUIDPipe()) mediaId: string,
    @Req() request: Request,
  ) {
    return this.media.archive(
      destinationId,
      mediaId,
      user.sub,
      auditContext(request),
    );
  }

  @Post('reorder')
  @ApiOkResponse({
    description: 'Reorders the complete active destination image gallery.',
  })
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('destinationId', new ParseUUIDPipe()) destinationId: string,
    @Body() dto: ReorderDestinationMediaDto,
    @Req() request: Request,
  ) {
    return this.media.reorder(
      destinationId,
      user.sub,
      dto,
      auditContext(request),
    );
  }
}
