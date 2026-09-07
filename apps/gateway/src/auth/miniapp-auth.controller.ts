/** Gateway 小程序认证入口，只转发身份交换，不持有微信密钥。 */
import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpException,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  LogoutResponse,
  MiniappSessionContextResponse,
  MiniappSessionResponse,
} from '@saas/contracts';

import { Public } from '../pipeline/pipeline.metadata.js';
import { MiniappLoginDto, RefreshSessionDto } from '../http/dto/auth.dto.js';
import type { SaasRequest } from '../pipeline/request-context.js';

@Controller('miniapp/auth')
export class MiniappAuthController {
  /** 转发微信登录到 Core，租户身份仅来自 Header。 */
  @Public()
  @Post('login')
  async login(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Body() input: MiniappLoginDto,
  ): Promise<MiniappSessionResponse> {
    return this.forward('/login', requireTenantId(tenantId), input);
  }

  /** 轮换一次性消费者 Refresh Token。 */
  @Public()
  @Post('refresh')
  refresh(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Body() input: RefreshSessionDto,
    @Headers('x-request-id') requestId?: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<MiniappSessionResponse> {
    return this.forward('/refresh', requireTenantId(tenantId), input, { requestId, userAgent });
  }

  /** 幂等撤销消费者 Refresh Token。 */
  @Public()
  @Post('logout')
  logout(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Body() input: RefreshSessionDto,
    @Headers('x-request-id') requestId?: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<LogoutResponse> {
    return this.forward('/logout', requireTenantId(tenantId), input, { requestId, userAgent });
  }

  /** 返回当前消费者会话；拒绝商家和管理员 Token。 */
  @Get('session')
  session(@Req() request: SaasRequest): Promise<MiniappSessionContextResponse> {
    if (!request.tenantId || !request.actor || request.actor.type !== 'customer') {
      throw new UnauthorizedException('Customer authentication context is unavailable');
    }
    return this.forward('/session', request.tenantId, undefined, {
      actorId: request.actor.id,
      requestId: request.header('x-request-id'),
      userAgent: request.header('user-agent'),
    });
  }

  private async forward<T>(
    path: string,
    tenantId: string,
    body?: unknown,
    context: { actorId?: string; requestId?: string; userAgent?: string } = {},
  ): Promise<T> {
    const coreBaseUrl = process.env.CORE_BASE_URL ?? 'http://localhost:3101';
    const response = await fetch(`${coreBaseUrl}/api/auth/miniapp${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'content-type': 'application/json',
        'x-tenant-id': tenantId,
        'x-actor-id': context.actorId ?? '',
        'x-request-id': context.requestId ?? '',
        'user-agent': context.userAgent ?? '',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const payload = text ? (JSON.parse(text) as T) : null;
    if (!response.ok) {
      throw new HttpException(
        payload && typeof payload === 'object' ? payload : { message: 'Core 服务返回空响应' },
        response.status,
      );
    }
    if (payload === null) throw new HttpException('Core 服务返回空响应', 502);
    return payload;
  }
}

function requireTenantId(tenantId: string | undefined): string {
  if (!tenantId) throw new BadRequestException('X-Tenant-Id header is required');
  return tenantId;
}
