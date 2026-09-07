/** Prisma 消费者认证仓储实现。 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/index.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import type {
  CustomerAuthRepository,
  CustomerIdentityRecord,
  CustomerSessionAuditContext,
} from '../../domain/ports/customer-auth.repository.port.js';

@Injectable()
export class PrismaCustomerAuthRepository implements CustomerAuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 在租户边界内创建或读取微信消费者。 */
  async upsertWechatCustomer(
    tenantId: string,
    openId: string,
    unionId?: string,
  ): Promise<CustomerIdentityRecord> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, status: 'active' },
    });
    if (!tenant) throw new UnauthorizedException('Tenant is unavailable');
    return this.prisma.customer.upsert({
      where: { tenantId_wechatOpenId: { tenantId, wechatOpenId: openId } },
      update: { wechatUnionId: unionId },
      create: { tenantId, wechatOpenId: openId, wechatUnionId: unionId },
      select: { id: true, tenantId: true, displayName: true },
    });
  }

  /** 保存哈希后的消费者刷新令牌。 */
  async createRefreshSession(
    customerId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.customerRefreshSession.create({ data: { customerId, tokenHash, expiresAt } });
  }

  /** 记录消费者登录审计，不记录 openId、code 或令牌。 */
  async recordLogin(tenantId: string, customerId: string): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorId: customerId,
        actorType: 'customer',
        action: 'login',
        resourceType: 'customer_session',
        resourceId: customerId,
      },
    });
  }

  /** 原子撤销旧令牌、创建新令牌并记录轮换审计。 */
  async rotateRefreshSession(
    tenantId: string,
    currentTokenHash: string,
    nextTokenHash: string,
    nextExpiresAt: Date,
    context: CustomerSessionAuditContext,
  ): Promise<CustomerIdentityRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.customerRefreshSession.findUnique({
        where: { tokenHash: currentTokenHash },
        include: { customer: { include: { tenant: true } } },
      });
      if (
        !session ||
        session.customer.tenantId !== tenantId ||
        session.revokedAt ||
        session.expiresAt.getTime() <= Date.now() ||
        session.customer.status !== 'active' ||
        session.customer.tenant.status !== 'active'
      ) {
        return null;
      }
      const revoked = await tx.customerRefreshSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (revoked.count !== 1) return null;
      await tx.customerRefreshSession.create({
        data: {
          customerId: session.customerId,
          tokenHash: nextTokenHash,
          expiresAt: nextExpiresAt,
        },
      });
      await this.recordSessionAudit(tx, tenantId, session.customerId, 'refresh', context);
      return {
        id: session.customer.id,
        tenantId: session.customer.tenantId,
        displayName: session.customer.displayName,
      };
    });
  }

  /** 幂等撤销当前租户的消费者令牌。 */
  async revokeRefreshSession(
    tenantId: string,
    tokenHash: string,
    context: CustomerSessionAuditContext,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const session = await tx.customerRefreshSession.findUnique({
        where: { tokenHash },
        include: { customer: true },
      });
      if (!session || session.customer.tenantId !== tenantId) return;
      const revoked = await tx.customerRefreshSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (revoked.count === 1) {
        await this.recordSessionAudit(tx, tenantId, session.customerId, 'logout', context);
      }
    });
  }

  /** 在租户边界内读取仍处于可用状态的消费者。 */
  async findActiveCustomer(
    tenantId: string,
    customerId: string,
  ): Promise<CustomerIdentityRecord | null> {
    return this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, status: 'active', tenant: { status: 'active' } },
      select: { id: true, tenantId: true, displayName: true },
    });
  }

  private async recordSessionAudit(
    tx: Prisma.TransactionClient,
    tenantId: string,
    customerId: string,
    action: 'refresh' | 'logout',
    context: CustomerSessionAuditContext,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: customerId,
        actorType: 'customer',
        action,
        resourceType: 'customer_session',
        resourceId: customerId,
        requestId: context.requestId,
        userAgent: context.userAgent,
      },
    });
  }
}
