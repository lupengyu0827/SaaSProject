/** 商家端 Gateway 统一响应信封解析：成功包装 { code: 0, message: 'ok', data, traceId }，失败包装 { code, message, data, traceId }。 */
import type { ApiErrorResponse, ApiResponse } from '@saas/contracts';

/**
 * 判断 payload 是否为 Gateway 成功信封。
 * 后端 ApiResponseInterceptor 统一包装为 `{ code: 0, message: 'ok', data, traceId }`；
 * 兼容未包装的裸对象（直接返回原始 data）。
 */
export function isSuccessEnvelope(value: unknown): value is ApiResponse<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.code === 0 && 'data' in record && typeof record.traceId === 'string';
}

/** 判断 payload 是否为 Gateway 失败信封。 */
export function isErrorEnvelope(value: unknown): value is ApiErrorResponse {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.code === 'number' && typeof record.traceId === 'string';
}

/**
 * 解出成功响应的业务数据。
 * 若为 Gateway 信封则返回 `data` 字段，否则原样返回（兼容裸对象与 mock）。
 */
export function unwrapApiData(payload: unknown): unknown {
  return isSuccessEnvelope(payload) ? payload.data : payload;
}
