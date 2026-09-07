/** 对外 HTTP API 的统一成功响应。 */
export interface ApiResponse<T> {
  code: 0;
  message: 'ok';
  data: T;
  traceId: string;
}

/** 对外 HTTP API 的统一失败响应。 */
export interface ApiErrorResponse {
  code: number;
  message: string;
  data: unknown;
  traceId: string;
}
