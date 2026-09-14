import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
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
import { BusinessVerificationsService } from './business-verifications.service';
import {
  ApproveBusinessVerificationDto,
  RejectBusinessVerificationDto,
  UploadVerificationDocumentDto,
} from './dto/business-verification.dto';
import { BusinessVerificationQueryDto } from './dto/business-verification-query.dto';

@ApiTags('my business verifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('my/businesses/:businessId/verifications')
export class MyBusinessVerificationsController {
  constructor(private readonly service: BusinessVerificationsService) {}

  @Post('draft')
  @ApiCreatedResponse({
    description: 'Creates or returns the editable verification draft.',
  })
  draft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
  ) {
    return this.service.getOrCreateDraft(user.sub, businessId);
  }

  @Get('draft')
  @ApiOkResponse({
    description: 'Current editable verification draft, if any.',
  })
  currentDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
  ) {
    return this.service.getCurrentDraft(user.sub, businessId);
  }

  // Legacy route remains, but can only submit an existing complete draft.
  @Post()
  @ApiCreatedResponse({ description: 'Submits the existing complete draft.' })
  submitCurrentDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
  ) {
    return this.service.submitCurrentDraft(user.sub, businessId);
  }

  @Post(':verificationId/documents')
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({
    description:
      'Validated private verification document uploaded and finalized.',
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }),
  )
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('verificationId') verificationId: string,
    @Body() dto: UploadVerificationDocumentDto,
    @UploadedFile()
    file: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },
  ) {
    return this.service.uploadDocument(
      user.sub,
      businessId,
      verificationId,
      dto.type,
      file,
    );
  }

  @Get(':verificationId/completeness')
  @ApiOkResponse({ description: 'Server-authoritative document completeness.' })
  completeness(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('verificationId') verificationId: string,
  ) {
    return this.service.completeness(user.sub, businessId, verificationId);
  }

  @Post(':verificationId/submit')
  @ApiOkResponse({
    description: 'Transitions a complete verification draft to pending review.',
  })
  submitDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('verificationId') verificationId: string,
  ) {
    return this.service.submitDraft(user.sub, businessId, verificationId);
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
@ApiBearerAuth()
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
  @ApiOkResponse({
    description: 'Business verification by id for an administrator.',
  })
  findAdminById(@Param('id') id: string) {
    return this.service.findAdminById(id);
  }

  @Get(':verificationId/documents/:documentId/access')
  @ApiOkResponse({
    description:
      'Short-lived private document access or protected-stream instruction.',
  })
  adminDocumentAccess(
    @Param('verificationId') verificationId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.service.adminDocumentAccess(verificationId, documentId);
  }

  @Get(':verificationId/documents/:documentId/content')
  @ApiOkResponse({
    description:
      'Protected private document stream for local development storage.',
  })
  async adminDocumentContent(
    @Param('verificationId') verificationId: string,
    @Param('documentId') documentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const document = await this.service.readAdminDocument(
      verificationId,
      documentId,
    );
    const safeFilename = document.filename.replace(/[^A-Za-z0-9._-]/g, '_');
    response.setHeader('Content-Type', document.mimeType);
    response.setHeader('Content-Length', String(document.sizeBytes));
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${safeFilename}"`,
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', 'sandbox');
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(document.body);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Approve pending business verification.' })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ApproveBusinessVerificationDto,
    @Req() request: Request,
  ) {
    return this.service.approve(user, id, dto, {
      correlationId: typeof request.id === 'string' ? request.id : undefined,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Reject pending business verification.' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectBusinessVerificationDto,
    @Req() request: Request,
  ) {
    return this.service.reject(user, id, dto, {
      correlationId: typeof request.id === 'string' ? request.id : undefined,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }
}
