import { describe, expect, it } from 'vitest';
import { TenantIsolationLevel, type TenantAccessState } from '@saas/contracts';
import { HttpException } from '@nestjs/common';

import { GatewayPolicyEngine } from '../src/pipeline/gateway-policy.engine.js';

const activePro: TenantAccessState = {
  tenantId: 'tenant-a',
  tenantStatus: 'active',
  subscriptionStatus: 'active',
  expiredAt: new Date(Date.now() + 86_400_000).toISOString(),
  isolationLevel: TenantIsolationLevel.SCHEMA,
  features: ['reports.advanced'],
  quotas: { api_calls: 100 },
  usage: { api_calls: 1 },
};

function expectStatus(action: () => void, status: number): void {
  try {
    action();
    throw new Error(`Expected HTTP ${status}`);
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(status);
  }
}

describe('GatewayPolicyEngine', () => {
  const policy = new GatewayPolicyEngine();

  it('returns 403 when the free plan calls an advanced feature', () => {
    expectStatus(
      () =>
        policy.enforce(
          { ...activePro, features: ['products.basic'] },
          {
            method: 'GET',
            requiredFeature: 'reports.advanced',
          },
        ),
      403,
    );
  });

  it('allows the professional plan to call an advanced feature', () => {
    expect(() =>
      policy.enforce(activePro, { method: 'GET', requiredFeature: 'reports.advanced' }),
    ).not.toThrow();
  });

  it('returns 402 for writes after the subscription expires', () => {
    expectStatus(
      () =>
        policy.enforce(
          {
            ...activePro,
            subscriptionStatus: 'expired',
            expiredAt: new Date(Date.now() - 60_000).toISOString(),
          },
          { method: 'POST' },
        ),
      402,
    );
  });

  it('returns 429 when a quota is exhausted', () => {
    expectStatus(
      () =>
        policy.enforce(
          { ...activePro, usage: { api_calls: 100 } },
          {
            method: 'GET',
            quotaMetric: 'api_calls',
          },
        ),
      429,
    );
  });
});
