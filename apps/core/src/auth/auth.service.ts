import { createHash, randomBytes } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthTokensResponse, LoginRequest } from '@saas/contracts';
import jwt from 'jsonwebtoken';

import { PrismaService } from '../shared/infrastructure/prisma/prisma.service.js';
import { verifyPassword } from './password-hasher.js';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 30;

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
  constructor(private readonly prisma: PrismaService) {}

  async login(input: LoginRequest): Promise<AuthTokensResponse> {
    const user = await this.prisma.adminUser.findFirst({
      where: { email: input.email, status: 'active', tenant: { subdomain: input.subdomain } },
    });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issue(user.id, user.tenantId);
  }

  async refresh(refreshToken: string): Promise<AuthTokensResponse> {
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: tokenHash(refreshToken) },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      session.user.status !== 'active'
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const revoked = await this.prisma.refreshSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count !== 1) throw new UnauthorizedException('Refresh token was already used');
    return this.issue(session.user.id, session.user.tenantId);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash: tokenHash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issue(userId: string, tenantId: string): Promise<AuthTokensResponse> {
    const accessToken = jwt.sign(
      { tenantId, actorType: 'admin_user', tokenType: 'access' },
      getJwtSecret(),
      {
        subject: userId,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        issuer: 'saas-core',
        audience: 'saas-gateway',
      },
    );
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + REFRESH_TOKEN_TTL_DAYS);
    await this.prisma.refreshSession.create({
      data: { userId, tokenHash: tokenHash(refreshToken), expiresAt },
    });
    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }
}
