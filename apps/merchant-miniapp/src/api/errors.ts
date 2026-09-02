/** 商家小程序统一 API 错误。 */
export class MerchantApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly traceId?: string,
  ) {
    super(message);
    this.name = 'MerchantApiError';
  }
}
