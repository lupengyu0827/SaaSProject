/** 商家认证 API：只访问独立的 merchant/auth 路径。 */
import type {
  AuthTokensResponse,
  LogoutResponse,
  MerchantLoginRequest,
  MerchantSessionResponse,
} from '@saas/contracts';

import {
  clearMerchantSession,
  getMerchantAccessToken,
  getMerchantApiBaseUrl,
  getMerchantRefreshToken,
  getMerchantTenantId,
  saveMerchantSession,
  saveMerchantTenantId,
} from '../../config/runtime';
import { isErrorEnvelope, unwrapApiData } from '../envelope';
import { MerchantApiError } from '../errors';

type MerchantContext = Omit<MerchantSessionResponse, keyof AuthTokensResponse>;
const REQUEST_TIMEOUT_MS = 15_000;

/** 使用邮箱和密码登录商家小程序，店铺由后端自动识别。 */
export async function loginMerchant(input: MerchantLoginRequest): Promise<MerchantSessionResponse> {
  const session = await requestMerchantAuth<MerchantSessionResponse>('/login', input);
  persistSession(session);
  return session;
}

/** 查询当前商家、店铺和权限。 */
export async function getMerchantSession(): Promise<MerchantContext> {
  const tenantId = getMerchantTenantId();
  const accessToken = getMerchantAccessToken();
  if (!tenantId || !accessToken) throw new MerchantApiError('请先登录店铺');
  try {
    return await requestMerchantAuth<MerchantContext>('/session', undefined, tenantId, accessToken);
  } catch (error: unknown) {
    if (!(error instanceof MerchantApiError) || error.statusCode !== 401) throw error;
    const refreshed = await refreshMerchantSession();
    return {
      merchant: refreshed.merchant,
      tenant: refreshed.tenant,
      permissions: refreshed.permissions,
    };
  }
}

/** 轮换商家 Refresh Token。 */
export async function refreshMerchantSession(): Promise<MerchantSessionResponse> {
  const refreshToken = getMerchantRefreshToken();
  if (!refreshToken) throw new MerchantApiError('登录状态已失效，请重新登录');
  try {
    const session = await requestMerchantAuth<MerchantSessionResponse>('/refresh', {
      refreshToken,
    });
    persistSession(session);
    return session;
  } catch (error: unknown) {
    clearMerchantSession();
    throw error;
  }
}

/** 撤销商家 Refresh Token 并清理本地会话。 */
export async function logoutMerchant(): Promise<void> {
  const refreshToken = getMerchantRefreshToken();
  try {
    if (refreshToken) {
      await requestMerchantAuth<LogoutResponse>('/logout', { refreshToken });
    }
  } finally {
    clearMerchantSession();
  }
}

function persistSession(session: MerchantSessionResponse): void {
  saveMerchantTenantId(session.tenant.id);
  saveMerchantSession(session.accessToken, session.refreshToken);
}

function requestMerchantAuth<T>(
  path: string,
  body?: unknown,
  tenantId?: string,
  accessToken?: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    void uni.request({
      url: `${getMerchantApiBaseUrl()}/merchant/auth${path}`,
      method: body === undefined ? 'GET' : 'POST',
      header: {
        ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        'X-Request-Id': createRequestId(),
        'content-type': 'application/json',
      },
      data: body as UniApp.RequestOptions['data'],
      timeout: REQUEST_TIMEOUT_MS,
      success: (response) => handleResponse(response, resolve, reject),
      fail: (failure) => reject(new MerchantApiError(getNetworkMessage(failure.errMsg))),
    });
  });
}

function handleResponse<T>(
  response: UniApp.RequestSuccessCallbackResult,
  resolve: (value: T) => void,
  reject: (error: MerchantApiError) => void,
): void {
  if (response.statusCode >= 200 && response.statusCode < 300) {
    resolve(unwrapApiData(response.data) as T);
    return;
  }
  const payload = isErrorEnvelope(response.data) ? response.data : null;
  reject(
    new MerchantApiError(
      payload?.message ?? getHttpMessage(response.statusCode),
      response.statusCode,
      payload?.traceId,
    ),
  );
}

function getHttpMessage(statusCode: number): string {
  if (statusCode === 401) return '账号或密码不正确';
  if (statusCode === 409) return '该账号关联多个店铺，请选择店铺后再登录';
  if (statusCode === 403) return '账号或店铺已停用，请联系店主';
  if (statusCode === 429) return '登录尝试过于频繁，请稍后再试';
  return '服务暂时不可用，请稍后重试';
}

function getNetworkMessage(message: string): string {
  return message.includes('timeout') ? '请求超时，请检查网络' : '网络连接失败，请稍后重试';
}

function createRequestId(): string {
  return `merchant-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}
