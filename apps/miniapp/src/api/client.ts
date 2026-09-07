/** 小程序统一 API Client：注入租户、令牌、请求 ID，解包 Gateway 信封并映射错误。 */
import {
  clearCustomerSession,
  getAccessToken,
  getApiBaseUrl,
  getCurrentTenantId,
  getRefreshToken,
} from '../config/runtime';
import { ApiClientError } from './errors';
import { isErrorEnvelope, unwrapApiData } from './envelope';
import { ensureCustomerAccessToken, refreshCustomerSession } from './modules/auth.api';

type QueryPrimitive = string | number | boolean;
const REQUEST_TIMEOUT_MS = 15_000;

export interface ApiRequestOptions {
  path: string;
  method?: UniApp.RequestOptions['method'];
  query?: Record<string, QueryPrimitive | undefined>;
  body?: UniApp.RequestOptions['data'];
}

/** 发起经过租户鉴权的 API 请求。 */
export async function requestApi<T>(options: ApiRequestOptions): Promise<T> {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new ApiClientError('尚未配置当前精品店租户');
  const accessToken = getAccessToken() ?? (await ensureCustomerAccessToken());
  try {
    return await executeRequest<T>(options, tenantId, accessToken);
  } catch (error: unknown) {
    if (!(error instanceof ApiClientError) || error.statusCode !== 401) throw error;
    const recoveredToken = await recoverAccessToken();
    return executeRequest<T>(options, tenantId, recoveredToken);
  }
}

/** 401 后恢复访问令牌：优先轮换 Refresh Token，失败则重新微信登录。 */
async function recoverAccessToken(): Promise<string> {
  if (getRefreshToken()) {
    try {
      const session = await refreshCustomerSession();
      return session.accessToken;
    } catch {
      // Refresh Token 已失效（一次性被消费），清空会话后走微信登录。
    }
  }
  clearCustomerSession();
  return ensureCustomerAccessToken();
}

function executeRequest<T>(
  options: ApiRequestOptions,
  tenantId: string,
  accessToken: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    void uni.request({
      url: buildRequestUrl(options.path, options.query),
      method: options.method ?? 'GET',
      header: {
        Authorization: `Bearer ${accessToken}`,
        'X-Tenant-Id': tenantId,
        'X-Request-Id': createRequestId(),
        'content-type': 'application/json',
      },
      data: options.body,
      timeout: REQUEST_TIMEOUT_MS,
      success: (response) => handleResponse(response, resolve, reject),
      fail: (failure) => reject(new ApiClientError(getNetworkErrorMessage(failure.errMsg))),
    });
  });
}

function buildRequestUrl(
  path: string,
  query: Record<string, QueryPrimitive | undefined> = {},
): string {
  const queryString = Object.entries(query)
    .filter((entry): entry is [string, QueryPrimitive] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}${queryString ? `?${queryString}` : ''}`;
}

function handleResponse<T>(
  response: UniApp.RequestSuccessCallbackResult,
  resolve: (value: T) => void,
  reject: (reason: ApiClientError) => void,
): void {
  if (response.statusCode >= 200 && response.statusCode < 300) {
    resolve(unwrapApiData(response.data) as T);
    return;
  }
  const payload = isErrorEnvelope(response.data) ? response.data : null;
  reject(
    new ApiClientError(
      payload?.message ?? getHttpErrorMessage(response.statusCode),
      response.statusCode,
      payload?.traceId,
    ),
  );
}

function getHttpErrorMessage(statusCode: number): string {
  if (statusCode === 401) return '登录状态已失效，请重新登录';
  if (statusCode === 403) return '当前账号没有查看商品的权限';
  if (statusCode === 402) return '当前精品店订阅暂不可用，请联系商家';
  if (statusCode === 429) return '访问过于频繁，请稍后再试';
  return '服务暂时不可用，请稍后重试';
}

function getNetworkErrorMessage(errorMessage: string): string {
  return errorMessage.includes('timeout')
    ? '请求超时，请检查网络后重试'
    : '网络连接失败，请检查网络后重试';
}

function createRequestId(): string {
  return `mini-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}
