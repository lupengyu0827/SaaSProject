import { TenantIsolationLevel } from '@saas/contracts';
import { describe, expect, it, vi } from 'vitest';

import { TenantContextResolver } from '../src/tenant/application/tenant-context.resolver.js';
import type { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';

describe('TenantContextResolver', () => {
  it('enables tenant id injection and RLS for logical isolation', async () => {
    const prisma = {
      tenant: {
        findUnique: vi.fn().mockResolvedValue({
          isolationLevel: TenantIsolationLevel.LOGICAL,
          schemaName: null,
          dbConnectionEnc: null,
        }),
      },
    } as unknown as PrismaService;

    await expect(new TenantContextResolver(prisma).resolve('tenant-a')).resolves.toMatchObject({
      connection: 'shared',
      schema: 'public',
      autoAppendTenantId: true,
      rlsEnabled: true,
    });
  });

  it('routes schema tenants to their dedicated schema', async () => {
    const prisma = {
      tenant: {
        findUnique: vi.fn().mockResolvedValue({
          isolationLevel: TenantIsolationLevel.SCHEMA,
          schemaName: 'tenant_a',
          dbConnectionEnc: null,
        }),
      },
    } as unknown as PrismaService;

    await expect(new TenantContextResolver(prisma).resolve('tenant-a')).resolves.toMatchObject({
      connection: 'shared',
      schema: 'tenant_a',
      autoAppendTenantId: false,
    });
  });
});
