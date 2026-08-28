/** Prisma 消费者认证仓储实现。 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import type {
  CustomerAuthRepository,
  CustomerIdentityRecord,
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
}
