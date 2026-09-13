import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { StorageAccessService } from './storage-access.service';

@ApiTags('public media')
@Controller('media')
export class StorageAccessController {
  constructor(private readonly storage: StorageAccessService) {}

  @Get('public/:mediaId')
  @ApiOkResponse({ description: 'Controlled public business media stream.' })
  async publicBusinessMedia(
    @Param('mediaId') mediaId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const media = await this.storage.readPublicBusinessMedia(mediaId);
    response.setHeader('Content-Type', media.mimeType);
    response.setHeader('Content-Length', String(media.sizeBytes));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'public, max-age=3600');
    return new StreamableFile(media.body);
  }
}
