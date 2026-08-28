import { ForbiddenException, HttpException, Injectable } from '@nestjs/common';
import type { TenantAccessState } from '@saas/contracts';

export interface PolicyInput {
  method: string;
  authorization?: string;
  requiredFeature?: string;
  quotaMetric?: string;
}

@Injectable()
export class GatewayPolicyEngine {
  enforce(state: TenantAccessState, input: PolicyInput): void {
    if (state.tenantStatus !== 'active') throw new HttpException('Tenant is suspended', 402);

    const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(input.method.toUpperCase());
    const expired = state.expiredAt ? new Date(state.expiredAt).getTime() <= Date.now() : false;
    if (state.subscriptionStatus !== 'active' || expired) {
      if (isWrite || this.isBeyondGracePeriod(state.expiredAt)) {
        throw new HttpException('Subscription payment required', 402);
      }
    }

    if (
      input.requiredFeature &&
      !state.features.includes('*') &&
      !state.features.includes(input.requiredFeature)
    ) {
      throw new ForbiddenException(`Feature ${input.requiredFeature} is not included in this plan`);
    }

    if (input.quotaMetric) {
      const limit = state.quotas[input.quotaMetric];
      const used = state.usage[input.quotaMetric] ?? 0;
      if (limit !== undefined && limit >= 0 && used >= limit) {
        throw new HttpException(`Quota ${input.quotaMetric} exceeded`, 429);
      }
    }
  }

  private isBeyondGracePeriod(expiredAt: string | null): boolean {
    if (!expiredAt) return true;
    return Date.now() - new Date(expiredAt).getTime() > 7 * 24 * 60 * 60 * 1000;
  }
}
