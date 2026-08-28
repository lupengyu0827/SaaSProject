import { Injectable } from '@nestjs/common';

import { Prisma, type TenantProbe } from '../../generated/prisma/index.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class RlsTenantProbeService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, payload: Record<string, unknown>): Promise<TenantProbe> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      return tx.tenantProbe.create({
        data: { tenantId, payload: payload as Prisma.InputJsonValue },
      });
    });
  }

  list(tenantId: string): Promise<TenantProbe[]> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      return tx.tenantProbe.findMany();
    });
  }
}
