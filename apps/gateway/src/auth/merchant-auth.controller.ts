/** 商家小程序认证代理，和消费者及平台会话严格分离。 */
import {
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthTokensResponse, LogoutResponse, MerchantSessionResponse } from '@saas/contracts';

import { Public } from '../pipeline/pipeline.metadata.js';
import type { SaasRequest } from '../pipeline/request-context.js';
import { MerchantLoginDto, RefreshSessionDto } from '../http/dto/auth.dto.js';

type MerchantContextResponse = Omit<MerchantSessionResponse, keyof AuthTokensResponse>;

@Controller('merchant/auth')
export class MerchantAuthController {
  @Public()
  @Post('login')
  login(
    @Req() request: SaasRequest,
    @Body() input: MerchantLoginDto,
  ): Promise<MerchantSessionResponse> {
    return this.forward('/login', request, input);
  }

  @Public()
  @Post('refresh')
  refresh(
    @Req() request: SaasRequest,
    @Body() input: RefreshSessionDto,
  ): Promise<MerchantSessionResponse> {
    return this.forward('/refresh', request, input);
  }

  @Public()
  @Post('logout')
  logout(@Req() request: SaasRequest, @Body() input: RefreshSessionDto): Promise<LogoutResponse> {
    return this.forward('/logout', request, input);
  }

  @Get('session')
  session(@Req() request: SaasRequest): Promise<MerchantContextResponse> {
    if (
      !request.tenantId ||
      !request.actor ||
      !['merchant_owner', 'merchant_staff'].includes(request.actor.type)
    ) {
      throw new UnauthorizedException('Merchant authentication context is unavailable');
    }
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
      `${process.env.CORE_BASE_URL ?? 'http://localhost:3101'}/api/auth/merchant${path}`,
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
