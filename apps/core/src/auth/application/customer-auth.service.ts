/** 小程序消费者认证用例：微信身份交换、消费者归档、发放会话与审计。 */
import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { MiniappSessionResponse } from '@saas/contracts';
import jwt from 'jsonwebtoken';
import {
  CUSTOMER_AUTH_REPOSITORY,
  type CustomerAuthRepository,
} from '../domain/ports/customer-auth.repository.port.js';
import { WECHAT_IDENTITY_PORT, type WechatIdentityPort } from './ports/wechat-identity.port.js';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 30;

@Injectable()
export class CustomerAuthService {
  constructor(
    @Inject(WECHAT_IDENTITY_PORT) private readonly wechatIdentity: WechatIdentityPort,
    @Inject(CUSTOMER_AUTH_REPOSITORY) private readonly repository: CustomerAuthRepository,
  ) {}

  /** 使用微信临时 code 登录当前租户的小程序。 */
  async login(tenantId: string, code: string): Promise<MiniappSessionResponse> {
    if (!tenantId || !code.trim())
      throw new BadRequestException('Tenant and WeChat code are required');
    const identity = await this.wechatIdentity.exchangeCode(code);
    const customer = await this.repository.upsertWechatCustomer(
      tenantId,
      identity.openId,
      identity.unionId,
    );
    const session = await this.issue(customer.id, customer.tenantId);
    await this.repository.recordLogin(customer.tenantId, customer.id);
    return { ...session, customer: { id: customer.id, displayName: customer.displayName } };
  }

  private async issue(
    customerId: string,
    tenantId: string,
  ): Promise<Omit<MiniappSessionResponse, 'customer'>> {
    const accessToken = jwt.sign(
      { tenantId, actorType: 'customer', tokenType: 'access' },
      getJwtSecret(),
      {
        subject: customerId,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        issuer: 'saas-core',
        audience: 'saas-gateway',
      },
    );
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + REFRESH_TOKEN_TTL_DAYS);
    await this.repository.createRefreshSession(customerId, tokenHash(refreshToken), expiresAt);
    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
function getJwtSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('JWT_ACCESS_SECRET must be at least 32 characters');
  return secret;
}
