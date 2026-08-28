import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { AccessTokenClaims } from '@saas/contracts';
import jwt, { type JwtPayload } from 'jsonwebtoken';

function getJwtSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('JWT_ACCESS_SECRET must be at least 32 characters');
  return secret;
}

@Injectable()
export class AuthTokenVerifier {
  verify(authorization: string | undefined, expectedTenantId: string): AccessTokenClaims {
    if (!authorization?.startsWith('Bearer '))
      throw new UnauthorizedException('Authentication required');
    try {
      const decoded = jwt.verify(authorization.slice(7), getJwtSecret(), {
        algorithms: ['HS256'],
        issuer: 'saas-core',
        audience: 'saas-gateway',
      }) as JwtPayload;
      const claims: Record<string, unknown> = decoded;
      if (
        typeof decoded.sub !== 'string' ||
        claims.tenantId !== expectedTenantId ||
        !['admin_user', 'customer'].includes(String(claims.actorType)) ||
        claims.tokenType !== 'access'
      ) {
        throw new UnauthorizedException('Token tenant or type is invalid');
      }
      return {
        sub: decoded.sub,
        tenantId: expectedTenantId,
        actorType: claims.actorType as 'admin_user' | 'customer',
        tokenType: 'access',
      };
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Access token is invalid or expired');
    }
  }
}
