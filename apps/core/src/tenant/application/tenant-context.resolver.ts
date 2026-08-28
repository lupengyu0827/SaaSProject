import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantIsolationLevel } from '@saas/contracts';

import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import type { TenantDbContext } from '../domain/tenant-db-context.js';

@Injectable()
export class TenantContextResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(tenantId: string): Promise<TenantDbContext> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const isolationLevel = tenant.isolationLevel as TenantIsolationLevel;
    switch (isolationLevel) {
      case TenantIsolationLevel.LOGICAL:
        return {
          tenantId,
          isolationLevel,
          connection: 'shared',
          schema: 'public',
          autoAppendTenantId: true,
          rlsEnabled: true,
        };
      case TenantIsolationLevel.SCHEMA:
        if (!tenant.schemaName) throw new Error(`Schema tenant ${tenantId} has no schemaName`);
        return {
          tenantId,
          isolationLevel,
          connection: 'shared',
          schema: tenant.schemaName,
          autoAppendTenantId: false,
          rlsEnabled: false,
        };
      case TenantIsolationLevel.PHYSICAL:
        if (!tenant.dbConnectionEnc) {
          throw new Error(`Physical tenant ${tenantId} has no encrypted connection`);
        }
        return {
          tenantId,
          isolationLevel,
          connection: 'dedicated',
          schema: 'public',
          autoAppendTenantId: false,
          rlsEnabled: false,
          encryptedConnection: tenant.dbConnectionEnc,
        };
      default:
        throw new Error(`Unsupported tenant isolation level: ${tenant.isolationLevel}`);
    }
  }
}
