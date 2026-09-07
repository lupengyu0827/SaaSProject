/** 小程序认证 API：微信登录、Refresh 轮换、退出与会话查询。所有请求直连 Gateway，不经过 client 以避免循环依赖。 */
import type {
  LogoutResponse,
  MiniappSessionContextResponse,
  MiniappSessionResponse,
} from '@saas/contracts';

import {
  clearCustomerSession,
  getAccessToken,
  getApiBaseUrl,
  getCurrentTenantId,
  getRefreshToken,
  saveCustomerSession,
} from '../../config/runtime';
import { ApiClientError } from '../errors';
import { isErrorEnvelope, unwrapApiData } from '../envelope';

let loginPromise: Promise<string> | null = null;
let refreshPromise: Promise<MiniappSessionResponse> | null = null;

/** 确保本地存在消费者 Access Token，并在需要时执行微信登录。 */
export async function ensureCustomerAccessToken(): Promise<string> {
  if (loginPromise) return loginPromise;
  loginPromise = createCustomerSession();
  try {
    return await loginPromise;
  } finally {
    loginPromise = null;
  }
}

/** 轮换一次性 Refresh Token，返回并持久化新会话。并发调用共享同一次轮换。 */
export function refreshCustomerSession(): Promise<MiniappSessionResponse> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = rotateCustomerSession();
  return refreshPromise.finally(() => {
    refreshPromise = null;
  });
}

/** 幂等撤销消费者 Refresh Token，并清理本地会话。 */
export async function logoutCustomerSession(): Promise<void> {
  const tenantId = getCurrentTenantId();
  const refreshToken = getRefreshToken();
  if (!tenantId || !refreshToken) {
    clearCustomerSession();
    return;
  }
  try {
    await requestAuthJson<LogoutResponse>('/miniapp/auth/logout', tenantId, { refreshToken });
  } catch {
    // 退出接口幂等；即使服务端拒绝也照常清理本地会话。
  } finally {
    clearCustomerSession();
  }
}

/** 查询当前消费者会话，用于恢复登录态或校验身份。 */
export async function getCustomerSession(): Promise<MiniappSessionContextResponse> {
  const tenantId = getCurrentTenantId();
  const accessToken = getAccessToken();
  if (!tenantId || !accessToken) throw new ApiClientError('尚未登录，请先完成微信登录');
  return requestAuthJson<MiniappSessionContextResponse>(
    '/miniapp/auth/session',
    tenantId,
    undefined,
    accessToken,
  );
}

async function createCustomerSession(): Promise<string> {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new ApiClientError('尚未配置当前精品店租户');
  const loginResult = await loginWithWechat();
  const data = await requestAuthJson<unknown>('/miniapp/auth/login', tenantId, {
    code: loginResult.code,
  });
  if (!isSession(data)) throw new ApiClientError('登录服务返回了无效会话，请稍后重试');
  saveCustomerSession(data.accessToken, data.refreshToken);
  return data.accessToken;
}

async function rotateCustomerSession(): Promise<MiniappSessionResponse> {
  const tenantId = getCurrentTenantId();
  const refreshToken = getRefreshToken();
  if (!tenantId || !refreshToken) throw new ApiClientError('会话已过期，请重新登录');
  const data = await requestAuthJson<unknown>('/miniapp/auth/refresh', tenantId, { refreshToken });
  if (!isSession(data)) throw new ApiClientError('登录服务返回了无效会话，请稍后重试');
  saveCustomerSession(data.accessToken, data.refreshToken);
  return data;
}

function loginWithWechat(): Promise<UniApp.LoginRes> {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: resolve,
      fail: () => reject(new ApiClientError('无法唤起微信登录，请稍后重试')),
    });
  });
}

/** 认证类直连请求：公开接口只带租户，受保护接口带 Bearer；解包 Gateway 信封。 */
function requestAuthJson<T>(
  path: string,
  tenantId: string,
  body?: UniApp.RequestOptions['data'],
  accessToken?: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const header: Record<string, string> = {
      'X-Tenant-Id': tenantId,
      'content-type': 'application/json',
    };
    if (accessToken) header.Authorization = `Bearer ${accessToken}`;
    uni.request({
      url: `${getApiBaseUrl()}${path}`,
      method: body === undefined ? 'GET' : 'POST',
      header,
      data: body,
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(unwrapApiData(response.data) as T);
          return;
        }
        const payload = isErrorEnvelope(response.data) ? response.data : null;
        reject(
          new ApiClientError(
            payload?.message ?? '请求失败，请稍后重试',
            response.statusCode,
            payload?.traceId,
          ),
        );
      },
      fail: () => reject(new ApiClientError('无法连接登录服务，请检查 Gateway 是否启动')),
    });
  });
}

function isSession(value: unknown): value is MiniappSessionResponse {
  if (typeof value !== 'object' || value === null) return false;
  const session = value as Record<string, unknown>;
  return typeof session.accessToken === 'string' && typeof session.refreshToken === 'string';
}
