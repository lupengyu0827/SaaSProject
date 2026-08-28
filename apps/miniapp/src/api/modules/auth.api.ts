/** 小程序认证 API：使用微信临时 code 换取平台 customer 会话。 */
import type { MiniappSessionResponse } from '@saas/contracts';

import { getApiBaseUrl, getCurrentTenantId, saveCustomerSession } from '../../config/runtime';
import { ApiClientError } from '../errors';

let loginPromise: Promise<string> | null = null;

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

async function createCustomerSession(): Promise<string> {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new ApiClientError('尚未配置当前精品店租户');
  const loginResult = await loginWithWechat();
  const session = await exchangeWechatCode(tenantId, loginResult.code);
  saveCustomerSession(session.accessToken, session.refreshToken);
  return session.accessToken;
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

function exchangeWechatCode(tenantId: string, code: string): Promise<MiniappSessionResponse> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${getApiBaseUrl()}/miniapp/auth/login`,
      method: 'POST',
      header: { 'X-Tenant-Id': tenantId, 'content-type': 'application/json' },
      data: { code },
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300 && isSession(response.data)) {
          resolve(response.data);
          return;
        }
        reject(
          new ApiClientError(
            response.statusCode >= 200 && response.statusCode < 300
              ? '登录服务返回了无效会话，请稍后重试'
              : '微信登录失败，请稍后重试',
            response.statusCode,
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
