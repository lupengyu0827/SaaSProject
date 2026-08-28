/** Gateway 小程序认证入口，只转发身份交换，不持有微信密钥。 */
import { Body, Controller, Headers, HttpException, Post } from '@nestjs/common';
import type { MiniappLoginRequest, MiniappSessionResponse } from '@saas/contracts';

import { Public } from '../pipeline/pipeline.metadata.js';

@Controller('miniapp/auth')
export class MiniappAuthController {
  /** 转发微信登录到 Core，租户身份仅来自 Header。 */
  @Public()
  @Post('login')
  async login(
    @Headers('x-tenant-id') tenantId: string,
    @Body() input: MiniappLoginRequest,
  ): Promise<MiniappSessionResponse> {
    const coreBaseUrl = process.env.CORE_BASE_URL ?? 'http://localhost:3001';
    const response = await fetch(`${coreBaseUrl}/api/auth/miniapp/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-id': tenantId },
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as MiniappSessionResponse;
    if (!response.ok) throw new HttpException(payload as object, response.status);
    return payload;
  }
}
