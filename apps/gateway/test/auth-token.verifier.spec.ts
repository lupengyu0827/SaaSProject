import { UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AuthTokenVerifier } from '../src/pipeline/auth-token.verifier.js';

const secret = 'test-secret-that-is-definitely-32-characters';

describe('AuthTokenVerifier', () => {
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = secret;
  });

  afterEach(() => {
    delete process.env.JWT_ACCESS_SECRET;
  });

  it('accepts a valid access token bound to the requested tenant', () => {
    const token = jwt.sign(
      { tenantId: 'tenant-a', actorType: 'admin_user', tokenType: 'access' },
      secret,
      { subject: 'actor-a', issuer: 'saas-core', audience: 'saas-gateway', expiresIn: 60 },
    );
    expect(new AuthTokenVerifier().verify(`Bearer ${token}`, 'tenant-a')).toMatchObject({
      sub: 'actor-a',
      tenantId: 'tenant-a',
    });
  });

  it('rejects using a valid token against another tenant', () => {
    const token = jwt.sign(
      { tenantId: 'tenant-a', actorType: 'admin_user', tokenType: 'access' },
      secret,
      { subject: 'actor-a', issuer: 'saas-core', audience: 'saas-gateway', expiresIn: 60 },
    );
    expect(() => new AuthTokenVerifier().verify(`Bearer ${token}`, 'tenant-b')).toThrow(
      UnauthorizedException,
    );
  });

  it('accepts a customer access token for C-end read routes', () => {
    const token = jwt.sign(
      { tenantId: 'tenant-a', actorType: 'customer', tokenType: 'access' },
      secret,
      { subject: 'customer-a', issuer: 'saas-core', audience: 'saas-gateway', expiresIn: 60 },
    );
    expect(new AuthTokenVerifier().verify(`Bearer ${token}`, 'tenant-a')).toMatchObject({
      sub: 'customer-a',
      actorType: 'customer',
    });
  });
});
