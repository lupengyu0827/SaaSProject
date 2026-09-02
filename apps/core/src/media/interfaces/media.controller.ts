/** Core 媒体接口：仅接受 Gateway 注入的租户和商家身份。 */
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type {
  ConfirmMediaUploadRequest,
  CreateMediaUploadSessionRequest,
  MediaAdminListQuery,
  MediaAdminListResponse,
  MediaAssetResponse,
  MediaUploadLimitsResponse,
  MediaUploadSessionResponse,
} from '@saas/contracts';
import { MediaService } from '../application/media.service.js';

interface UploadedMediaFile {
  buffer: Buffer;
  mimetype: string;
}

interface MediaHttpResponse {
  type(contentType: string): MediaHttpResponse;
  send(content: Buffer): void;
}

@Controller('internal/media')
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Get('limits')
  limits(): MediaUploadLimitsResponse {
    return this.media.limits();
  }

  @Get('admin/assets')
  listForAdmin(
    @Headers('x-tenant-id') tenantId: string,
    @Query() query: MediaAdminListQuery,
  ): Promise<MediaAdminListResponse> {
    return this.media.listForAdmin(tenantId, query);
  }

  @Post('upload-sessions')
  createSession(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Body() input: CreateMediaUploadSessionRequest,
  ): Promise<MediaUploadSessionResponse> {
    return this.media.createSession(tenantId, actorId, input);
  }

  @Post('upload-sessions/:id/content')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  upload(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('id') id: string,
    @UploadedFile() file: UploadedMediaFile,
  ): Promise<MediaUploadSessionResponse> {
    return this.media.upload(tenantId, actorId, id, file.mimetype, file.buffer);
  }

  @Post('upload-sessions/:id/confirm')
  confirm(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('id') id: string,
    @Body() input: ConfirmMediaUploadRequest,
  ): Promise<MediaAssetResponse> {
    return this.media.confirm(tenantId, actorId, id, input);
  }

  @Get('assets/:id/content')
  async content(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Res() response: MediaHttpResponse,
  ): Promise<void> {
    const asset = await this.media.read(tenantId, id);
    response.type(asset.mimeType).send(asset.content);
  }

  @Get('public/assets/:id/content')
  async publicContent(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Res() response: MediaHttpResponse,
  ): Promise<void> {
    const asset = await this.media.readPublic(tenantId, id);
    response.type(asset.mimeType).send(asset.content);
  }
}
