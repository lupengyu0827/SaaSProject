import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { RegisterTenantRequest, RegisterTenantResponse } from '@saas/contracts';

import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { hashPassword } from '../../auth/password-hasher.js';

@Injectable()
export class RegisterTenantService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async execute(input: RegisterTenantRequest): Promise<RegisterTenantResponse> {
    const planCode = input.planCode ?? 'free';
    const plan = await this.prisma.plan.findUnique({ where: { code: planCode } });
    if (!plan) throw new NotFoundException(`Plan ${planCode} not found`);

    const exists = await this.prisma.tenant.findUnique({ where: { subdomain: input.subdomain } });
    if (exists) throw new ConflictException('Subdomain already exists');

    const now = new Date();
    const passwordHash = await hashPassword(input.ownerPassword);
    const expiredAt = new Date(now);
    expiredAt.setUTCDate(expiredAt.getUTCDate() + (plan.trialDays || 30));

    return this.prisma.$transaction(async (tx) => {
      const permissions = await tx.permission.findMany({ select: { id: true } });
      if (permissions.length === 0) {
        throw new Error('Permissions are not seeded; run pnpm db:seed first');
      }
      const tenant = await tx.tenant.create({
        data: {
          name: input.name,
          subdomain: input.subdomain,
          isolationLevel: plan.isolationLevel,
          planId: plan.id,
          expiredAt,
          schemaName:
            plan.isolationLevel === 'schema'
              ? `tenant_${crypto.randomUUID().replaceAll('-', '')}`
              : null,
        },
      });
      const subscription = await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          currentPeriodStart: now,
          currentPeriodEnd: expiredAt,
          trialEnd: plan.trialDays > 0 ? expiredAt : null,
        },
      });
      const owner = await tx.adminUser.create({
        data: {
          tenantId: tenant.id,
          email: input.ownerEmail ?? `owner@${input.subdomain}.local`,
          displayName: input.ownerName ?? 'Owner',
          passwordHash,
        },
      });
      await tx.role.create({
        data: {
          tenantId: tenant.id,
          code: 'owner',
          name: '所有者',
          isSystem: true,
          permissions: {
            createMany: { data: permissions.map(({ id }) => ({ permissionId: id })) },
          },
          userRoles: { create: { userId: owner.id } },
        },
      });
      await tx.tenant.update({
        where: { id: tenant.id },
        data: { subscriptionId: subscription.id },
      });

      return {
        tenantId: tenant.id,
        subscriptionId: subscription.id,
        planCode: plan.code,
        expiredAt: expiredAt.toISOString(),
        ownerActorId: owner.id,
      };
    });
  }
}
