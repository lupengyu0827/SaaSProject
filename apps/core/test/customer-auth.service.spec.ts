/** 小程序消费者认证用例测试。 */
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
});
