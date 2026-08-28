/** 小程序运行时配置：集中管理环境配置与消费者会话存储。 */
const TENANT_STORAGE_KEY = 'saas.currentTenantId';
const ACCESS_TOKEN_STORAGE_KEY = 'saas.accessToken';
const REFRESH_TOKEN_STORAGE_KEY = 'saas.refreshToken';
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3000/api';

/** 获取 API Gateway 基础地址。 */
export function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

/** 获取当前租户 ID。 */
export function getCurrentTenantId(): string | null {
  return (
    uni.getStorageSync<string>(TENANT_STORAGE_KEY) || import.meta.env.VITE_DEMO_TENANT_ID || null
  );
}

/** 获取当前 Access Token。 */
export function getAccessToken(): string | null {
  return (
    uni.getStorageSync<string>(ACCESS_TOKEN_STORAGE_KEY) ||
    import.meta.env.VITE_DEMO_ACCESS_TOKEN ||
    null
  );
}

/** 获取当前 Refresh Token。 */
export function getRefreshToken(): string | null {
  return uni.getStorageSync<string>(REFRESH_TOKEN_STORAGE_KEY) || null;
}

/** 持久化消费者会话令牌。 */
export function saveCustomerSession(accessToken: string, refreshToken: string): void {
  uni.setStorageSync(ACCESS_TOKEN_STORAGE_KEY, accessToken);
  uni.setStorageSync(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
}

/** 清理失效的消费者会话。 */
export function clearCustomerSession(): void {
  uni.removeStorageSync(ACCESS_TOKEN_STORAGE_KEY);
  uni.removeStorageSync(REFRESH_TOKEN_STORAGE_KEY);
}
