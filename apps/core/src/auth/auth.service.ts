import { createHash, randomBytes } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  ActorType,
  AdminSessionResponse,
  AuthTokensResponse,
  LoginRequest,
  MerchantLoginRequest,
  MerchantSessionResponse,
} from '@saas/contracts';
import jwt from 'jsonwebtoken';

import { PrismaService } from '../shared/infrastructure/prisma/prisma.service.js';
import { verifyPassword } from './password-hasher.js';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 30;

interface AuthAuditContext {
  requestId?: string;
  userAgent?: string;
}

interface MerchantAuthUser {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  passwordHash: string;
  status: string;
  tenant: { id: string; name: string; subdomain: string; status: string };
  userRoles: Array<{ role: { code: string } }>;
}

interface MerchantRefreshSessionRecord {
  id: string;
  actorType: string;
  revokedAt: Date | null;
  expiresAt: Date;
  user: MerchantAuthUser;
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

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async login(input: LoginRequest, context: AuthAuditContext = {}): Promise<AuthTokensResponse> {
    const user = await this.prisma.adminUser.findFirst({
      where: { email: input.email, tenant: { subdomain: input.subdomain } },
      include: { tenant: true },
    });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status !== 'active') throw new ForbiddenException('管理员账号已冻结');
    if (user.tenant.status !== 'active') throw new ForbiddenException('租户已冻结或停用');
    const tokens = await this.issue(user.id, user.tenantId);
    await this.recordAudit(user.tenantId, user.id, 'login', context);
    return tokens;
  }

  /** 签发仅供商家小程序使用的 owner/staff 会话。 */
  async merchantLogin(
    input: MerchantLoginRequest,
    context: AuthAuditContext = {},
  ): Promise<MerchantSessionResponse> {
    const user = await this.findActiveUser(input);
    const actorType = this.resolveMerchantActorType(user.userRoles.map(({ role }) => role.code));
    const tokens = await this.issue(user.id, user.tenantId, actorType);
    await this.recordAudit(user.tenantId, user.id, 'login', context, actorType);
    return { ...tokens, ...(await this.merchantSession(user.tenantId, user.id)) };
  }

  /** 轮换商家 Refresh Token，并重新确认员工仍在职且拥有商家角色。 */
  async merchantRefresh(
    refreshToken: string,
    context: AuthAuditContext = {},
  ): Promise<MerchantSessionResponse> {
    const session = await this.findActiveRefreshSession(refreshToken);
    const actorType = this.resolveMerchantActorType(
      session.user.userRoles.map(({ role }) => role.code),
    );
    await this.revokeRefreshSession(session.id);
    const tokens = await this.issue(session.user.id, session.user.tenantId, actorType);
    await this.recordAudit(session.user.tenantId, session.user.id, 'refresh', context, actorType);
    return { ...tokens, ...(await this.merchantSession(session.user.tenantId, session.user.id)) };
  }

  async refresh(refreshToken: string, context: AuthAuditContext = {}): Promise<AuthTokensResponse> {
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: tokenHash(refreshToken) },
      include: { user: { include: { tenant: true } } },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      session.user.status !== 'active' ||
      session.user.tenant.status !== 'active' ||
      session.actorType !== 'admin_user'
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const revoked = await this.prisma.refreshSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count !== 1) throw new UnauthorizedException('Refresh token was already used');
    const tokens = await this.issue(session.user.id, session.user.tenantId);
    await this.recordAudit(session.user.tenantId, session.user.id, 'refresh', context);
    return tokens;
  }

  async logout(refreshToken: string, context: AuthAuditContext = {}): Promise<void> {
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: tokenHash(refreshToken) },
      include: { user: true },
    });
    if (!session) return;
    await this.prisma.refreshSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.recordAudit(session.user.tenantId, session.user.id, 'logout', context);
  }

  /** 返回管理员和租户上下文；actorId 与 tenantId 必须同时匹配。 */
  async session(tenantId: string, actorId: string): Promise<AdminSessionResponse> {
    const user = await this.prisma.adminUser.findFirst({
      where: { id: actorId, tenantId, status: 'active' },
      include: {
        tenant: true,
        userRoles: {
          select: {
            role: {
              select: { permissions: { select: { permission: { select: { key: true } } } } },
            },
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException('Admin session is unavailable');
    const permissions = [
      ...new Set(
        user.userRoles.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission.key),
        ),
      ),
    ];
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        subdomain: user.tenant.subdomain,
        status: user.tenant.status as AdminSessionResponse['tenant']['status'],
      },
      permissions,
    };
  }

  /** 返回商家、店铺和权限上下文。 */
  async merchantSession(
    tenantId: string,
    actorId: string,
  ): Promise<Omit<MerchantSessionResponse, keyof AuthTokensResponse>> {
    const user = await this.prisma.adminUser.findFirst({
      where: { id: actorId, tenantId, status: 'active', tenant: { status: 'active' } },
      include: {
        tenant: true,
        userRoles: {
          select: {
            role: {
              select: {
                code: true,
                permissions: { select: { permission: { select: { key: true } } } },
              },
            },
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException('Merchant session is unavailable');
    const actorType = this.resolveMerchantActorType(user.userRoles.map(({ role }) => role.code));
    const permissions = [
      ...new Set(
        user.userRoles.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission.key),
        ),
      ),
    ];
    return {
      merchant: { id: user.id, displayName: user.displayName, email: user.email, actorType },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        subdomain: user.tenant.subdomain,
        status: user.tenant.status as MerchantSessionResponse['tenant']['status'],
      },
      permissions,
    };
  }

  private async issue(
    userId: string,
    tenantId: string,
    actorType: ActorType = 'admin_user',
  ): Promise<AuthTokensResponse> {
    const accessToken = jwt.sign({ tenantId, actorType, tokenType: 'access' }, getJwtSecret(), {
      subject: userId,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      issuer: 'saas-core',
      audience: 'saas-gateway',
    });
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + REFRESH_TOKEN_TTL_DAYS);
    await this.prisma.refreshSession.create({
      data: { userId, tokenHash: tokenHash(refreshToken), actorType, expiresAt },
    });
    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }

  private async recordAudit(
    tenantId: string,
    actorId: string,
    action: 'login' | 'refresh' | 'logout',
    context: AuthAuditContext,
    actorType: ActorType = 'admin_user',
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId,
          actorType,
          action,
          resourceType: 'admin_session',
          resourceId: actorId,
          requestId: context.requestId,
          userAgent: context.userAgent,
        },
      });
    });
  }

  /** 根据账号凭据自动定位唯一店铺；兼容旧客户端传入店铺标识缩小范围。 */
  private async findActiveUser(input: MerchantLoginRequest): Promise<MerchantAuthUser> {
    const candidates = await this.prisma.adminUser.findMany({
      where: {
        email: input.email,
        ...(input.subdomain ? { tenant: { subdomain: input.subdomain } } : {}),
      },
      include: { tenant: true, userRoles: { select: { role: { select: { code: true } } } } },
    });
    const verified = (
      await Promise.all(
        candidates.map(async (candidate) => ({
          candidate,
          passwordMatches: await verifyPassword(input.password, candidate.passwordHash),
        })),
      )
    ).filter(({ passwordMatches }) => passwordMatches);
    if (verified.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (verified.length > 1) {
      throw new ConflictException('该账号关联多个店铺，请选择店铺后再登录');
    }
    const user = verified[0]!.candidate;
    if (user.status !== 'active') throw new ForbiddenException('商家账号已冻结');
    if (user.tenant.status !== 'active') throw new ForbiddenException('租户已冻结或停用');
    return user;
  }

  private async findActiveRefreshSession(
    refreshToken: string,
  ): Promise<MerchantRefreshSessionRecord> {
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: tokenHash(refreshToken) },
      include: {
        user: {
          include: {
            tenant: true,
            userRoles: { select: { role: { select: { code: true } } } },
          },
        },
      },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      session.user.status !== 'active' ||
      session.user.tenant.status !== 'active' ||
      !['merchant_owner', 'merchant_staff'].includes(session.actorType)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return session;
  }

  private async revokeRefreshSession(sessionId: string): Promise<void> {
    const revoked = await this.prisma.refreshSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count !== 1) throw new UnauthorizedException('Refresh token was already used');
  }

  private resolveMerchantActorType(roleCodes: string[]): 'merchant_owner' | 'merchant_staff' {
    if (roleCodes.includes('owner')) return 'merchant_owner';
    if (roleCodes.length > 0) return 'merchant_staff';
    throw new ForbiddenException('当前账号没有商家角色');
  }
}
