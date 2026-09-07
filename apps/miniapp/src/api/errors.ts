/** 页面可安全展示的统一 API 错误。 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly traceId?: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}
