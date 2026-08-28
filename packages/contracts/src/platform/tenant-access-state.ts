import type { TenantIsolationLevel } from '../tenant/tenant-isolation-level.js';

export type SubscriptionStatus = 'active' | 'past_due' | 'unpaid' | 'expired' | 'canceled';

export interface TenantAccessState {
  tenantId: string;
  tenantStatus: 'active' | 'suspended' | 'terminated';
  subscriptionStatus: SubscriptionStatus;
  expiredAt: string | null;
  isolationLevel: TenantIsolationLevel;
  features: string[];
  quotas: Record<string, number>;
  usage: Record<string, number>;
}

export interface RegisterTenantRequest {
  name: string;
  subdomain: string;
  planCode?: string;
  ownerEmail?: string;
  ownerName?: string;
  ownerPassword: string;
}

export interface LoginRequest {
  subdomain: string;
  email: string;
  password: string;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** 微信小程序登录请求，租户身份必须由 Header 提供。 */
export interface MiniappLoginRequest {
  code: string;
}

/** 小程序消费者会话。 */
export interface MiniappSessionResponse extends AuthTokensResponse {
  customer: {
    id: string;
    displayName: string | null;
  };
}

export interface AccessTokenClaims {
  sub: string;
  tenantId: string;
  actorType: 'admin_user' | 'customer';
  tokenType: 'access';
}

export interface RegisterTenantResponse {
  tenantId: string;
  subscriptionId: string;
  planCode: string;
  expiredAt: string;
  ownerActorId: string;
}

export interface ActorPermissionsResponse {
  tenantId: string;
  actorId: string;
  permissions: string[];
}

export interface CreateAuditLogRequest {
  tenantId: string;
  actorId?: string;
  actorType?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  diff?: Record<string, unknown>;
}
