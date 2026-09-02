/** PC 管理端会话持久化：只保存认证所需的最小令牌与租户标识。 */
import type { AuthTokensResponse } from '@saas/contracts';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const TENANT_ID_KEY = 'tenantId';

export const readAccessToken = (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY);
export const readRefreshToken = (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY);
export const readTenantId = (): string | null => localStorage.getItem(TENANT_ID_KEY);

export function persistTokens(tokens: AuthTokensResponse): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  const tenantId = readTenantIdFromToken(tokens.accessToken);
  if (tenantId) persistTenantId(tenantId);
}

export function persistTenantId(tenantId: string): void {
  localStorage.setItem(TENANT_ID_KEY, tenantId);
}

export function clearSessionStorage(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TENANT_ID_KEY);
}

function readTenantIdFromToken(accessToken: string): string | null {
  try {
    const encodedPayload = accessToken.split('.')[1];
    if (!encodedPayload) return null;
    const payload = JSON.parse(
      atob(encodedPayload.replaceAll('-', '+').replaceAll('_', '/')),
    ) as unknown;
    if (typeof payload !== 'object' || payload === null || !('tenantId' in payload)) return null;
    return typeof payload.tenantId === 'string' ? payload.tenantId : null;
  } catch {
    return null;
  }
}
