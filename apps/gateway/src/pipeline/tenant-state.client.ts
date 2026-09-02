import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { TenantAccessState } from '@saas/contracts';

import { RedisService } from '../infrastructure/redis.service.js';

@Injectable()
export class TenantStateClient {
  private readonly memoryFallback = new Map<
    string,
    { state: TenantAccessState; expiresAt: number }
  >();

  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  async get(tenantId: string): Promise<TenantAccessState> {
    const key = `tenant_state:${tenantId}`;
    try {
      const cached = await (await this.redis.getClient()).get(key);
      if (cached) return this.withPendingUsage(JSON.parse(cached) as TenantAccessState);
    } catch {
      const fallback = this.memoryFallback.get(key);
      if (fallback && fallback.expiresAt > Date.now()) return this.withPendingUsage(fallback.state);
    }

    const coreBaseUrl = process.env.CORE_BASE_URL ?? 'http://localhost:3001';
    const response = await fetch(`${coreBaseUrl}/api/platform/tenants/${tenantId}/access-state`);
    if (!response.ok) throw new ServiceUnavailableException('Unable to resolve tenant state');
    const state = (await response.json()) as TenantAccessState;

    try {
      await (await this.redis.getClient()).set(key, JSON.stringify(state), { EX: 30 });
    } catch {
      this.memoryFallback.set(key, { state, expiresAt: Date.now() + 30_000 });
    }
    return this.withPendingUsage(state);
  }

  async invalidate(tenantId: string): Promise<void> {
    const key = `tenant_state:${tenantId}`;
    this.memoryFallback.delete(key);
    try {
      await (await this.redis.getClient()).del(key);
    } catch {
      // Core remains the source of truth when Redis is temporarily unavailable.
    }
  }

  private async withPendingUsage(state: TenantAccessState): Promise<TenantAccessState> {
    const metrics = Object.keys(state.quotas);
    if (metrics.length === 0) return state;
    const period = new Date().toISOString().slice(0, 7);
    try {
      const client = await this.redis.getClient();
      const pending = await client.mGet(
        metrics.map((metric) => `usage:${state.tenantId}:${metric}:${period}`),
      );
      return {
        ...state,
        usage: Object.fromEntries(
          metrics.map((metric, index) => [
            metric,
            (state.usage[metric] ?? 0) + Number(pending[index] ?? 0),
          ]),
        ),
      };
    } catch {
      return state;
    }
  }
}
