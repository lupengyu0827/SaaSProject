/** 消费者会话数据库 E2E：验证一次性轮换、跨租户拒绝、撤销与审计事务。 */
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaCustomerAuthRepository } from '../src/auth/infrastructure/repositories/prisma-customer-auth.repository.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';

const runDatabaseE2e = process.env.RUN_DATABASE_E2E === 'true';

describe.runIf(runDatabaseE2e)('customer session database flow', () => {
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const currentTokenHash = hashToken('current-token');
  const nextTokenHash = hashToken('next-token');
  let prisma: PrismaService;
  let repository: PrismaCustomerAuthRepository;
  let setupComplete = false;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaCustomerAuthRepository(prisma);
    await prisma.tenant.createMany({
      data: [
        {
          id: tenantId,
          name: 'Customer Session E2E',
          subdomain: `customer-${tenantId.slice(0, 8)}`,
        },
        {
          id: otherTenantId,
          name: 'Other Customer Session E2E',
          subdomain: `customer-${otherTenantId.slice(0, 8)}`,
        },
      ],
    });
    setupComplete = true;
  });

  afterAll(async () => {
    if (!prisma) return;
    if (setupComplete) {
      await prisma.auditLog.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await prisma.customer.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    }
    await prisma.$disconnect();
  });

  it('rotates once, rejects cross-tenant use and revokes idempotently', async () => {
    const customer = await repository.upsertWechatCustomer(tenantId, `openid-${tenantId}`);
    await repository.createRefreshSession(
      customer.id,
      currentTokenHash,
      new Date(Date.now() + 60_000),
    );

    await expect(
      repository.rotateRefreshSession(
        tenantId,
        currentTokenHash,
        nextTokenHash,
        new Date(Date.now() + 60_000),
        { requestId: 'refresh-e2e' },
      ),
    ).resolves.toMatchObject({ id: customer.id, tenantId });
    await expect(
      repository.rotateRefreshSession(
        tenantId,
        currentTokenHash,
        hashToken('replayed-token'),
        new Date(Date.now() + 60_000),
        {},
      ),
    ).resolves.toBeNull();
    await expect(
      repository.rotateRefreshSession(
        otherTenantId,
        nextTokenHash,
        hashToken('cross-tenant-token'),
        new Date(Date.now() + 60_000),
        {},
      ),
    ).resolves.toBeNull();

    await repository.revokeRefreshSession(tenantId, nextTokenHash, { requestId: 'logout-e2e' });
    await repository.revokeRefreshSession(tenantId, nextTokenHash, { requestId: 'logout-repeat' });

    expect(
      await prisma.auditLog.count({
        where: { tenantId, actorId: customer.id, action: { in: ['refresh', 'logout'] } },
      }),
    ).toBe(2);
  });
});

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
