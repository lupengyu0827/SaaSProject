/** 小程序消费者认证用例测试。 */
import { UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CustomerAuthService } from '../src/auth/application/customer-auth.service.js';
import type { WechatIdentityPort } from '../src/auth/application/ports/wechat-identity.port.js';
import type {
  CustomerAuthRepository,
  CustomerIdentityRecord,
} from '../src/auth/domain/ports/customer-auth.repository.port.js';

const JWT_SECRET = 'test-secret-that-is-definitely-32-characters';

class WechatIdentityStub implements WechatIdentityPort {
  exchangeCode(code: string): Promise<{ openId: string }> {
    return Promise.resolve({ openId: `open-${code}` });
  }
}

class CustomerRepositoryStub implements CustomerAuthRepository {
  readonly sessions: Array<{ customerId: string; tokenHash: string }> = [];
  readonly audits: Array<{ tenantId: string; customerId: string }> = [];
  readonly sessionActions: string[] = [];
  readonly customer: CustomerIdentityRecord = {
    id: 'customer-1',
    tenantId: 'tenant-1',
    displayName: null,
  };

  upsertWechatCustomer(tenantId: string): Promise<CustomerIdentityRecord> {
    return Promise.resolve({ id: 'customer-1', tenantId, displayName: null });
  }

  createRefreshSession(customerId: string, tokenHash: string): Promise<void> {
    this.sessions.push({ customerId, tokenHash });
    return Promise.resolve();
  }

  recordLogin(tenantId: string, customerId: string): Promise<void> {
    this.audits.push({ tenantId, customerId });
    return Promise.resolve();
  }

  rotateRefreshSession(
    tenantId: string,
    currentTokenHash: string,
    nextTokenHash: string,
  ): Promise<CustomerIdentityRecord | null> {
    const index = this.sessions.findIndex(({ tokenHash }) => tokenHash === currentTokenHash);
    if (tenantId !== this.customer.tenantId || index < 0) return Promise.resolve(null);
    this.sessions.splice(index, 1, { customerId: this.customer.id, tokenHash: nextTokenHash });
    this.sessionActions.push('refresh');
    return Promise.resolve(this.customer);
  }

  revokeRefreshSession(tenantId: string, tokenHash: string): Promise<void> {
    const index = this.sessions.findIndex((session) => session.tokenHash === tokenHash);
    if (tenantId === this.customer.tenantId && index >= 0) {
      this.sessions.splice(index, 1);
      this.sessionActions.push('logout');
    }
    return Promise.resolve();
  }

  findActiveCustomer(tenantId: string, customerId: string): Promise<CustomerIdentityRecord | null> {
    return Promise.resolve(
      tenantId === this.customer.tenantId && customerId === this.customer.id ? this.customer : null,
    );
  }
}

describe('CustomerAuthService', () => {
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = JWT_SECRET;
  });

  afterEach(() => {
    delete process.env.JWT_ACCESS_SECRET;
  });

  it('issues a customer session and records a hashed refresh session plus audit', async () => {
    const repository = new CustomerRepositoryStub();
    const service = new CustomerAuthService(new WechatIdentityStub(), repository);
    const session = await service.login('tenant-1', 'wx-code');

    expect(session.customer.id).toBe('customer-1');
    expect(session.accessToken).not.toContain('open-wx-code');
    expect(repository.sessions[0]?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(repository.audits).toEqual([{ tenantId: 'tenant-1', customerId: 'customer-1' }]);
  });

  it('rotates a refresh token once and rejects replay', async () => {
    const repository = new CustomerRepositoryStub();
    const service = new CustomerAuthService(new WechatIdentityStub(), repository);
    const login = await service.login('tenant-1', 'wx-code');
    const refreshed = await service.refresh('tenant-1', login.refreshToken);

    expect(refreshed.refreshToken).not.toBe(login.refreshToken);
    expect(repository.sessionActions).toEqual(['refresh']);
    await expect(service.refresh('tenant-1', login.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('does not rotate a token through another tenant', async () => {
    const repository = new CustomerRepositoryStub();
    const service = new CustomerAuthService(new WechatIdentityStub(), repository);
    const login = await service.login('tenant-1', 'wx-code');

    await expect(service.refresh('tenant-2', login.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('logs out idempotently and rejects the revoked token', async () => {
    const repository = new CustomerRepositoryStub();
    const service = new CustomerAuthService(new WechatIdentityStub(), repository);
    const login = await service.login('tenant-1', 'wx-code');

    await expect(service.logout('tenant-1', login.refreshToken)).resolves.toEqual({
      loggedOut: true,
    });
    await expect(service.logout('tenant-1', login.refreshToken)).resolves.toEqual({
      loggedOut: true,
    });
    expect(repository.sessionActions).toEqual(['logout']);
    await expect(service.refresh('tenant-1', login.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns only a tenant-bound active customer session', async () => {
    const service = new CustomerAuthService(new WechatIdentityStub(), new CustomerRepositoryStub());

    await expect(service.session('tenant-1', 'customer-1')).resolves.toEqual({
      tenantId: 'tenant-1',
      customer: { id: 'customer-1', displayName: null },
    });
    await expect(service.session('tenant-2', 'customer-1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
