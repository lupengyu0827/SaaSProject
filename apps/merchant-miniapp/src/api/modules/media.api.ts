/** 商家媒体 API：创建会话、上传文件并确认租户级临时资产。 */
import type {
  ConfirmMediaUploadRequest,
  CreateMediaUploadSessionRequest,
  MediaAssetResponse,
  MediaUploadSessionResponse,
} from '@saas/contracts';

import {
  getMerchantAccessToken,
  getMerchantApiBaseUrl,
  getMerchantTenantId,
} from '../../config/runtime';
import { MerchantApiError } from '../errors';

/** 创建短时上传会话。 */
export function createMediaUploadSession(
  input: CreateMediaUploadSessionRequest,
): Promise<MediaUploadSessionResponse> {
  return requestJson('/media/upload-sessions', 'POST', input);
}

/** 将手机本地文件上传到已创建的会话。 */
export function uploadMediaFile(
  session: MediaUploadSessionResponse,
  filePath: string,
  onProgress: (progress: number) => void,
): { task: UniApp.UploadTask; result: Promise<MediaUploadSessionResponse> } {
  let task!: UniApp.UploadTask;
  const result = new Promise<MediaUploadSessionResponse>((resolve, reject) => {
    task = uni.uploadFile({
      url: absoluteUrl(session.uploadUrl),
      filePath,
      name: 'file',
      header: authHeaders(),
      success: (response) => parseUploadResponse(response, resolve, reject),
      fail: (failure) => reject(new MerchantApiError(failure.errMsg || '图片上传失败')),
    });
    task.onProgressUpdate(({ progress }) => onProgress(progress));
  });
  return { task, result };
}

/** 确认对象完整性并生成可绑定业务的临时媒体资产。 */
export function confirmMediaUpload(
  sessionId: string,
  input: ConfirmMediaUploadRequest = {},
): Promise<MediaAssetResponse> {
  return requestJson(`/media/upload-sessions/${sessionId}/confirm`, 'POST', input);
}

function requestJson<T>(path: string, method: 'GET' | 'POST', data?: unknown): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    void uni.request({
      url: absoluteUrl(path),
      method,
      header: { ...authHeaders(), 'content-type': 'application/json' },
      data: data as UniApp.RequestOptions['data'],
      timeout: 15_000,
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data as T);
        else reject(new MerchantApiError(errorMessage(response.data), response.statusCode));
      },
      fail: (failure) => reject(new MerchantApiError(failure.errMsg || '网络连接失败')),
    });
  });
}

function authHeaders(): Record<string, string> {
  const accessToken = getMerchantAccessToken();
  const tenantId = getMerchantTenantId();
  if (!accessToken || !tenantId) throw new MerchantApiError('请先登录店铺');
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-Tenant-Id': tenantId,
    'X-Request-Id': `merchant-media-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  };
}

function absoluteUrl(path: string): string {
  return path.startsWith('http') ? path : `${getMerchantApiBaseUrl()}${path.replace(/^\/api/, '')}`;
}

function parseUploadResponse<T>(
  response: UniApp.UploadFileSuccessCallbackResult,
  resolve: (value: T) => void,
  reject: (error: MerchantApiError) => void,
): void {
  const payload = parseJson(response.data);
  if (response.statusCode >= 200 && response.statusCode < 300) resolve(payload as T);
  else reject(new MerchantApiError(errorMessage(payload), response.statusCode));
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return { message: value || '服务返回内容无法解析' };
  }
}

function errorMessage(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'message' in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '图片上传失败，请稍后重试';
}
