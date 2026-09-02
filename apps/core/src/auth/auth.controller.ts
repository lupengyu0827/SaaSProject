import { Body, Controller, Get, Headers, Inject, Post } from '@nestjs/common';
import type {
  AdminSessionResponse,
  AuthTokensResponse,
  LoginRequest,
  LogoutResponse,
  MerchantLoginRequest,
  MerchantSessionResponse,
  MiniappLoginRequest,
  MiniappSessionResponse,
  RefreshSessionRequest,
} from '@saas/contracts';

import { AuthService } from './auth.service.js';
import { CustomerAuthService } from './application/customer-auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly auth: AuthService,
    @Inject(CustomerAuthService)
    private readonly customerAuth: CustomerAuthService,
  ) {}

  /** 微信小程序消费者登录。租户只能从可信 Header 获取。 */
  @Post('miniapp/login')
  miniappLogin(
    @Headers('x-tenant-id') tenantId: string,
    @Body() input: MiniappLoginRequest,
  ): Promise<MiniappSessionResponse> {
    return this.customerAuth.login(tenantId, input.code);
  }

  /** 商家小程序账号密码登录。 */
  @Post('merchant/login')
  merchantLogin(
    @Body() input: MerchantLoginRequest,
    @Headers('x-request-id') requestId?: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<MerchantSessionResponse> {
    return this.auth.merchantLogin(input, { requestId, userAgent });
  }

  /** 商家小程序轮换 Refresh Token。 */
  @Post('merchant/refresh')
  merchantRefresh(
    @Body() input: RefreshSessionRequest,
    @Headers('x-request-id') requestId?: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<MerchantSessionResponse> {
    return this.auth.merchantRefresh(input.refreshToken, { requestId, userAgent });
  }

  /** 商家小程序退出。 */
  @Post('merchant/logout')
  async merchantLogout(
    @Body() input: RefreshSessionRequest,
    @Headers('x-request-id') requestId?: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<LogoutResponse> {
    await this.auth.logout(input.refreshToken, { requestId, userAgent });
    return { loggedOut: true };
  }

  /** 查询 Gateway 已校验的商家会话。 */
  @Get('merchant/session')
  merchantSession(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
  ): Promise<Omit<MerchantSessionResponse, keyof AuthTokensResponse>> {
    return this.auth.merchantSession(tenantId, actorId);
  }

  @Post('login')
  login(
    @Body() input: LoginRequest,
    @Headers('x-request-id') requestId?: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthTokensResponse> {
    return this.auth.login(input, { requestId, userAgent });
  }

  @Post('refresh')
  refresh(
    @Body() input: RefreshSessionRequest,
    @Headers('x-request-id') requestId?: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthTokensResponse> {
    return this.auth.refresh(input.refreshToken, { requestId, userAgent });
  }

  @Post('logout')
  async logout(
    @Body() input: RefreshSessionRequest,
    @Headers('x-request-id') requestId?: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<LogoutResponse> {
    await this.auth.logout(input.refreshToken, { requestId, userAgent });
    return { loggedOut: true };
  }

  /** 查询已通过 Gateway 校验的当前管理员会话。 */
  @Get('session')
  session(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
  ): Promise<AdminSessionResponse> {
    return this.auth.session(tenantId, actorId);
  }
}
