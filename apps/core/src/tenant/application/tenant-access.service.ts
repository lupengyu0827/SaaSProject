import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantAccessState } from '@saas/contracts';

import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : [];
}

function asNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] => typeof entry[1] === 'number',
    ),
  );
}

@Injectable()
export class TenantAccessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getState(tenantId: string): Promise<TenantAccessState> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true, currentSubscription: true },
    });
    if (!tenant?.plan || !tenant.currentSubscription) {
      throw new NotFoundException('Tenant access state not found');
    }

    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);
    const metrics = await this.prisma.usageMetric.findMany({
      where: { tenantId, periodStart },
    });

    return {
      tenantId,
      tenantStatus: tenant.status as TenantAccessState['tenantStatus'],
      subscriptionStatus: tenant.currentSubscription
        .status as TenantAccessState['subscriptionStatus'],
      expiredAt: tenant.expiredAt?.toISOString() ?? null,
      isolationLevel: tenant.isolationLevel as TenantAccessState['isolationLevel'],
      features: asStringArray(tenant.plan.features),
      quotas: asNumberRecord(tenant.plan.quotas),
      usage: Object.fromEntries(metrics.map((metric) => [metric.metricKey, Number(metric.amount)])),
    };
  }
}
