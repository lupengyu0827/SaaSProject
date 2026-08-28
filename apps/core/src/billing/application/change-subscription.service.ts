import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { GatewayCacheInvalidator } from '../../shared/infrastructure/gateway-cache-invalidator.service.js';

@Injectable()
export class ChangeSubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: GatewayCacheInvalidator,
  ) {}

  async changePlan(tenantId: string, planCode: string): Promise<void> {
    const plan = await this.prisma.plan.findUnique({ where: { code: planCode } });
    if (!plan) throw new NotFoundException(`Plan ${planCode} not found`);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant?.subscriptionId) throw new NotFoundException('Active subscription not found');

    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id: tenant.subscriptionId },
        data: { planId: plan.id, status: 'active' },
      }),
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          planId: plan.id,
          isolationLevel: plan.isolationLevel,
          schemaName:
            plan.isolationLevel === 'schema'
              ? (tenant.schemaName ?? `tenant_${crypto.randomUUID().replaceAll('-', '')}`)
              : null,
        },
      }),
    ]);
    await this.cache.invalidateTenant(tenantId);
  }

  async expire(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant?.subscriptionId) throw new NotFoundException('Active subscription not found');
    const expiredAt = new Date(Date.now() - 60_000);
    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id: tenant.subscriptionId },
        data: { status: 'expired', currentPeriodEnd: expiredAt },
      }),
      this.prisma.tenant.update({ where: { id: tenantId }, data: { expiredAt } }),
    ]);
    await this.cache.invalidateTenant(tenantId);
  }
}
