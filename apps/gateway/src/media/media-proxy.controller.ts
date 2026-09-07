/** Gateway 媒体代理：执行商家鉴权、权限与配额管道后转发上传。 */
import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  Req,
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
import {
  EnforceQuota,
  MeterUsage,
  Public,
  RequireFeature,
  RequirePermission,
} from '../pipeline/pipeline.metadata.js';
import type { SaasRequest } from '../pipeline/request-context.js';

interface UploadedMediaFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

interface MediaHttpResponse {
  type(contentType: string): MediaHttpResponse;
  send(content: Buffer): void;
}

@Controller('media')
@RequireFeature('products.basic')
@EnforceQuota('storage_bytes')
@MeterUsage('api_calls')
export class MediaProxyController {
  @Get('limits')
  @RequirePermission('products.read')
  limits(@Req() request: SaasRequest): Promise<MediaUploadLimitsResponse> {
    return this.forwardJson('/limits', request);
  }

  @Get('admin/assets')
  @RequirePermission('products.read')
  listForAdmin(
    @Req() request: SaasRequest,
    @Query() query: MediaAdminListQuery,
  ): Promise<MediaAdminListResponse> {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    return this.forwardJson(`/admin/assets?${params.toString()}`, request);
  }

  @Post('upload-sessions')
  @RequirePermission('products.write')
  createSession(
    @Req() request: SaasRequest,
    @Body() input: CreateMediaUploadSessionRequest,
  ): Promise<MediaUploadSessionResponse> {
    return this.forwardJson('/upload-sessions', request, 'POST', input);
  }

  @Post('upload-sessions/:id/content')
  @RequirePermission('products.write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024, files: 1 } }))
  upload(
    @Req() request: SaasRequest,
    @Param('id') id: string,
    @UploadedFile() file: UploadedMediaFile,
  ): Promise<MediaUploadSessionResponse> {
    const form = new FormData();
    form.append(
      'file',
      new Blob([Uint8Array.from(file.buffer)], { type: file.mimetype }),
      file.originalname,
    );
    return this.forwardForm(`/upload-sessions/${id}/content`, request, form);
  }

  @Post('upload-sessions/:id/confirm')
  @RequirePermission('products.write')
  confirm(
    @Req() request: SaasRequest,
    @Param('id') id: string,
    @Body() input: ConfirmMediaUploadRequest,
  ): Promise<MediaAssetResponse> {
    return this.forwardJson(`/upload-sessions/${id}/confirm`, request, 'POST', input);
  }

  @Get('assets/:id/content')
  @RequirePermission('products.read')
  async content(
    @Req() request: SaasRequest,
    @Param('id') id: string,
    @Res() response: MediaHttpResponse,
  ): Promise<void> {
    const upstream = await fetch(`${coreBaseUrl()}/api/internal/media/assets/${id}/content`, {
      headers: this.contextHeaders(request),
    });
    if (!upstream.ok)
      throw new HttpException(exceptionPayload(await safePayload(upstream)), upstream.status);
    response.type(upstream.headers.get('content-type') ?? 'application/octet-stream');
    response.send(Buffer.from(await upstream.arrayBuffer()));
  }

  /** 匿名读取已发布商品图片；Core 再校验租户、绑定关系和在售状态。 */
  @Get('public/assets/:id/content')
  @Public()
  async publicContent(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Res() response: MediaHttpResponse,
  ): Promise<void> {
    if (!tenantId) throw new HttpException({ message: '缺少店铺标识' }, 400);
    const upstream = await fetch(
      `${coreBaseUrl()}/api/internal/media/public/assets/${id}/content`,
      {
        headers: { 'x-tenant-id': tenantId },
      },
    );
    if (!upstream.ok)
      throw new HttpException(exceptionPayload(await safePayload(upstream)), upstream.status);
    response.type(upstream.headers.get('content-type') ?? 'application/octet-stream');
    response.send(Buffer.from(await upstream.arrayBuffer()));
  }

  private async forwardJson<T>(
    path: string,
    request: SaasRequest,
    method = 'GET',
    body?: unknown,
  ): Promise<T> {
    const upstream = await fetch(`${coreBaseUrl()}/api/internal/media${path}`, {
      method,
      headers: { ...this.contextHeaders(request), 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = (await safePayload(upstream)) as T;
    if (!upstream.ok) throw new HttpException(payload as object, upstream.status);
    return payload;
  }

  private async forwardForm<T>(path: string, request: SaasRequest, body: FormData): Promise<T> {
    const upstream = await fetch(`${coreBaseUrl()}/api/internal/media${path}`, {
      method: 'POST',
      headers: this.contextHeaders(request),
      body,
    });
    const payload = (await safePayload(upstream)) as T;
    if (!upstream.ok) throw new HttpException(payload as object, upstream.status);
    return payload;
  }

  private contextHeaders(request: SaasRequest): Record<string, string> {
    if (!request.tenantId || !request.actor) throw new Error('Gateway request context is missing');
    return { 'x-tenant-id': request.tenantId, 'x-actor-id': request.actor.id };
  }
}

function coreBaseUrl(): string {
  return process.env.CORE_BASE_URL ?? 'http://localhost:3101';
}

async function safePayload(response: globalThis.Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return { message: 'Core 服务返回空响应' };
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function exceptionPayload(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : { message: String(value) };
}
