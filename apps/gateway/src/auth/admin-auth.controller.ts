/** PC 管理员认证代理：公开处理登录/轮换/退出，受保护地返回当前会话。 */
import {
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { AdminSessionResponse, AuthTokensResponse, LogoutResponse } from '@saas/contracts';

import { Public } from '../pipeline/pipeline.metadata.js';
import type { SaasRequest } from '../pipeline/request-context.js';
import { AdminLoginDto, RefreshSessionDto } from '../http/dto/auth.dto.js';

@Controller('admin/auth')
export class AdminAuthController {
  /** 管理员登录；租户由子域字段解析，不能由请求 Header 冒充。 */
  @Public()
  @Post('login')
  login(@Req() request: SaasRequest, @Body() input: AdminLoginDto): Promise<AuthTokensResponse> {
    return this.forward('/login', request, input);
  }

  /** 轮换一次性 Refresh Token。 */
  @Public()
  @Post('refresh')
  refresh(
    @Req() request: SaasRequest,
    @Body() input: RefreshSessionDto,
  ): Promise<AuthTokensResponse> {
    return this.forward('/refresh', request, input);
  }

  /** 撤销当前 Refresh Token。 */
  @Public()
  @Post('logout')
  logout(@Req() request: SaasRequest, @Body() input: RefreshSessionDto): Promise<LogoutResponse> {
    return this.forward('/logout', request, input);
  }

  /** 获取当前已认证管理员及租户上下文。 */
  @Get('session')
  session(@Req() request: SaasRequest): Promise<AdminSessionResponse> {
    if (!request.tenantId || !request.actor || request.actor.type !== 'admin_user')
      throw new UnauthorizedException('Authentication context is unavailable');
    return this.forward('/session', request, undefined, {
      'x-tenant-id': request.tenantId,
      'x-actor-id': request.actor.id,
    });
  }

  private async forward<T>(
    path: string,
    request: SaasRequest,
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<T> {
    const response = await fetch(
      `${process.env.CORE_BASE_URL ?? 'http://localhost:3101'}/api/auth${path}`,
      {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': request.header('x-request-id') ?? '',
          'user-agent': request.header('user-agent') ?? '',
          ...extraHeaders,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
    const responseText = await response.text();
    const payload = responseText ? (JSON.parse(responseText) as T) : null;
    if (!response.ok)
      throw new HttpException(
        payload && typeof payload === 'object' ? payload : { message: 'Core 服务返回空响应' },
        response.status,
      );
    if (payload === null) throw new HttpException('Core 服务返回空响应', 502);
    return payload;
  }
}
