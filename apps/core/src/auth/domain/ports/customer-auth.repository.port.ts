/** 消费者认证仓储端口，应用层不依赖 Prisma。 */
export const CUSTOMER_AUTH_REPOSITORY = Symbol('CUSTOMER_AUTH_REPOSITORY');
export interface CustomerIdentityRecord {
  id: string;
  tenantId: string;
  displayName: string | null;
}
export interface CustomerSessionAuditContext {
  requestId?: string;
  userAgent?: string;
}
export interface CustomerAuthRepository {
  upsertWechatCustomer(
    tenantId: string,
    openId: string,
    unionId?: string,
  ): Promise<CustomerIdentityRecord>;
  createRefreshSession(customerId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  recordLogin(tenantId: string, customerId: string): Promise<void>;
  rotateRefreshSession(
    tenantId: string,
    currentTokenHash: string,
    nextTokenHash: string,
    nextExpiresAt: Date,
    context: CustomerSessionAuditContext,
  ): Promise<CustomerIdentityRecord | null>;
  revokeRefreshSession(
    tenantId: string,
    tokenHash: string,
    context: CustomerSessionAuditContext,
  ): Promise<void>;
  findActiveCustomer(tenantId: string, customerId: string): Promise<CustomerIdentityRecord | null>;
}
