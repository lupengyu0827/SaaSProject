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

/** 系统内可签发访问令牌的身份类型。 */
export type ActorType =
  'admin_user' | 'platform_admin' | 'merchant_owner' | 'merchant_staff' | 'customer';

/**
 * 商家账号密码登录请求。
 * 默认由后端根据账号自动识别店铺；subdomain 仅用于兼容旧客户端或多店铺账号选择。
 */
export interface MerchantLoginRequest {
  email: string;
  password: string;
  subdomain?: string;
}

/** 商家小程序当前会话。 */
export interface MerchantSessionResponse extends AuthTokensResponse {
  merchant: {
    id: string;
    displayName: string;
    email: string;
    actorType: 'merchant_owner' | 'merchant_staff';
  };
  tenant: {
    id: string;
    name: string;
    subdomain: string;
    status: 'active' | 'suspended' | 'terminated';
  };
  permissions: string[];
}

/** 管理后台当前登录会话，供 Gateway 与 PC 端共享。 */
export interface AdminSessionResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  tenant: {
    id: string;
    name: string;
    subdomain: string;
    status: 'active' | 'suspended' | 'terminated';
  };
  permissions: string[];
}

/** Refresh Token 轮换请求。 */
export interface RefreshSessionRequest {
  refreshToken: string;
}

/** 管理员退出响应。 */
export interface LogoutResponse {
  loggedOut: true;
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

/** 小程序消费者当前会话；不返回任何令牌。 */
export interface MiniappSessionContextResponse {
  customer: {
    id: string;
    displayName: string | null;
  };
  tenantId: string;
}

export interface AccessTokenClaims {
  sub: string;
  tenantId: string;
  actorType: ActorType;
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
