/** 小程序消费者认证用例：微信身份交换、消费者归档、发放会话与审计。 */
import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type {
  LogoutResponse,
  MiniappSessionContextResponse,
  MiniappSessionResponse,
} from '@saas/contracts';
import jwt from 'jsonwebtoken';
import {
  CUSTOMER_AUTH_REPOSITORY,
  type CustomerAuthRepository,
  type CustomerSessionAuditContext,
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

  /** 一次性轮换消费者 Refresh Token，并重新确认消费者和租户仍可用。 */
  async refresh(
    tenantId: string,
    refreshToken: string,
    context: CustomerSessionAuditContext = {},
  ): Promise<MiniappSessionResponse> {
    if (!tenantId || !refreshToken) throw new UnauthorizedException('Invalid refresh token');
    const nextRefreshToken = createRefreshToken();
    const customer = await this.repository.rotateRefreshSession(
      tenantId,
      tokenHash(refreshToken),
      tokenHash(nextRefreshToken),
      refreshExpiresAt(),
      context,
    );
    if (!customer) throw new UnauthorizedException('Invalid or already used refresh token');
    return {
      ...this.createAccessToken(customer.id, customer.tenantId),
      refreshToken: nextRefreshToken,
      customer: { id: customer.id, displayName: customer.displayName },
    };
  }

  /** 幂等撤销消费者 Refresh Token；未知或已撤销令牌不暴露存在性。 */
  async logout(
    tenantId: string,
    refreshToken: string,
    context: CustomerSessionAuditContext = {},
  ): Promise<LogoutResponse> {
    if (tenantId && refreshToken) {
      await this.repository.revokeRefreshSession(tenantId, tokenHash(refreshToken), context);
    }
    return { loggedOut: true };
  }

  /** 返回 Gateway 已校验的消费者会话上下文。 */
  async session(tenantId: string, customerId: string): Promise<MiniappSessionContextResponse> {
    const customer = await this.repository.findActiveCustomer(tenantId, customerId);
    if (!customer) throw new UnauthorizedException('Customer session is unavailable');
    return {
      customer: { id: customer.id, displayName: customer.displayName },
      tenantId: customer.tenantId,
    };
  }

  private async issue(
    customerId: string,
    tenantId: string,
  ): Promise<Omit<MiniappSessionResponse, 'customer'>> {
    const access = this.createAccessToken(customerId, tenantId);
    const refreshToken = createRefreshToken();
    await this.repository.createRefreshSession(
      customerId,
      tokenHash(refreshToken),
      refreshExpiresAt(),
    );
    return { ...access, refreshToken };
  }

  private createAccessToken(
    customerId: string,
    tenantId: string,
  ): Omit<MiniappSessionResponse, 'customer' | 'refreshToken'> {
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
    return { accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }
}

function createRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

function refreshExpiresAt(): Date {
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + REFRESH_TOKEN_TTL_DAYS);
  return expiresAt;
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
