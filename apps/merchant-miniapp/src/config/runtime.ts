/** 商家小程序运行配置与独立会话存储。 */
const TENANT_STORAGE_KEY = 'saas.merchant.currentTenantId';
const ACCESS_TOKEN_STORAGE_KEY = 'saas.merchant.accessToken';
const REFRESH_TOKEN_STORAGE_KEY = 'saas.merchant.refreshToken';
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3100/api';

/** 获取 Gateway 地址。 */
export function getMerchantApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

/** 获取当前商家租户。 */
export function getMerchantTenantId(): string | null {
  return (
    uni.getStorageSync<string>(TENANT_STORAGE_KEY) || import.meta.env.VITE_DEMO_TENANT_ID || null
  );
}

/** 保存服务端确认的商家租户，不能信任登录前客户端自行声明。 */
export function saveMerchantTenantId(tenantId: string): void {
  uni.setStorageSync(TENANT_STORAGE_KEY, tenantId);
}

/** 获取商家 Access Token。 */
export function getMerchantAccessToken(): string | null {
  return uni.getStorageSync<string>(ACCESS_TOKEN_STORAGE_KEY) || null;
}

/** 获取商家 Refresh Token。 */
export function getMerchantRefreshToken(): string | null {
  return uni.getStorageSync<string>(REFRESH_TOKEN_STORAGE_KEY) || null;
}

/** 持久化商家会话，禁止与消费者会话共用 Key。 */
export function saveMerchantSession(accessToken: string, refreshToken: string): void {
  uni.setStorageSync(ACCESS_TOKEN_STORAGE_KEY, accessToken);
  uni.setStorageSync(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
}

/** 清理商家会话。 */
export function clearMerchantSession(): void {
  uni.removeStorageSync(ACCESS_TOKEN_STORAGE_KEY);
  uni.removeStorageSync(REFRESH_TOKEN_STORAGE_KEY);
  uni.removeStorageSync(TENANT_STORAGE_KEY);
}
