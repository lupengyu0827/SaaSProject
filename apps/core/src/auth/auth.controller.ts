import { Body, Controller, Headers, Post } from '@nestjs/common';
import type {
  AuthTokensResponse,
  LoginRequest,
  MiniappLoginRequest,
  MiniappSessionResponse,
} from '@saas/contracts';

import { AuthService } from './auth.service.js';
import { CustomerAuthService } from './application/customer-auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
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

  @Post('login')
  login(@Body() input: LoginRequest): Promise<AuthTokensResponse> {
    return this.auth.login(input);
  }

  @Post('refresh')
  refresh(@Body() input: { refreshToken: string }): Promise<AuthTokensResponse> {
    return this.auth.refresh(input.refreshToken);
  }

  @Post('logout')
  async logout(@Body() input: { refreshToken: string }): Promise<{ loggedOut: true }> {
    await this.auth.logout(input.refreshToken);
    return { loggedOut: true };
  }
}
