/** PC 管理端统一 API Client：注入身份、租户和请求 ID，并共享单次令牌刷新。 */
import type { AuthTokensResponse } from '@saas/contracts';

import {
  clearSessionStorage,
  persistTokens,
  readAccessToken,
  readRefreshToken,
  readTenantId,
} from '../auth/session-storage';

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  authenticated?: boolean;
  retryOnUnauthorized?: boolean;
}

let refreshPromise: Promise<boolean> | null = null;

export function requestApi<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return request<T>(`/commerce${path}`, { authenticated: true, ...options });
}

export function requestAuthApi<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return request<T>(`/admin/auth${path}`, options);
}

export function requestMediaApi<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return request<T>(`/media${path}`, { authenticated: true, ...options });
}

async function request<T>(path: string, options: ApiRequestOptions): Promise<T> {
  const authenticated = options.authenticated ?? false;
  const response = await send(path, options, authenticated);
  if (response.status === 401 && authenticated && options.retryOnUnauthorized !== false) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return parseResponse<T>(await send(path, options, true));
  }
  return parseResponse<T>(response);
}

function send(path: string, options: ApiRequestOptions, authenticated: boolean): Promise<Response> {
  const tenantId = readTenantId() ?? import.meta.env.VITE_TENANT_ID;
  const token = readAccessToken();
  return fetch(`${import.meta.env.VITE_API_BASE_URL ?? '/api'}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': crypto.randomUUID(),
      ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
      ...(authenticated && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = performRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function performRefresh(): Promise<boolean> {
  const refreshToken = readRefreshToken();
  if (!refreshToken) return false;
  const response = await send(
    '/admin/auth/refresh',
    { method: 'POST', body: { refreshToken } },
    false,
  );
  if (!response.ok) {
    clearSessionStorage();
    return false;
  }
  persistTokens(await parseResponse<AuthTokensResponse>(response));
  return true;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const responseText = await response.text();
  const payload = parsePayload(responseText);
  if (!response.ok) throw new Error(readErrorMessage(payload, response.status));
  if (payload === null) throw new Error('服务返回了空响应，请确认 Gateway 与 Core 已启动');
  return payload as T;
}

function parsePayload(responseText: string): unknown {
  if (!responseText.trim()) return null;
  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    throw new Error('服务响应格式异常，请确认请求已转发到 Gateway');
  }
}

function readErrorMessage(payload: unknown, status: number): string {
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const message = payload.message;
    if (typeof message === 'string') {
      if (status === 401) return '账号、密码或租户信息不正确';
      if (status === 403) return '当前账号没有访问权限';
      return message;
    }
  }
  return status >= 500 ? '服务暂时不可用，请稍后重试' : '请求失败，请稍后重试';
}
