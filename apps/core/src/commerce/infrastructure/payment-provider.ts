import type { PaymentChannel } from '@saas/contracts';

export interface CreateProviderPaymentInput {
  tenantId: string;
  paymentId: string;
  paymentNo: string;
  amount: string;
  description: string;
  expiresAt: Date;
  openId?: string;
}

/** 渠道退款请求；金额均使用十进制定点字符串。 */
export interface CreateProviderRefundInput {
  tenantId: string;
  refundId: string;
  refundNo: string;
  providerTradeNo: string;
  amount: string;
  originalAmount: string;
  reason: string;
}

/** 渠道受理结果；异步渠道返回 pending，最终状态由回调确认。 */
export interface CreateProviderRefundResult {
  providerRefundNo: string;
  eventId: string;
  status: 'pending' | 'succeeded';
}

/** 主动查单请求。金额用于校验渠道返回值，避免错单串单。 */
export interface QueryProviderPaymentInput {
  paymentNo: string;
  amount: string;
}

/** 渠道支付状态；pending 不触发本地终态变更。 */
export interface QueryProviderPaymentResult {
  status: 'pending' | 'succeeded' | 'failed';
  providerTradeNo?: string;
  paidAmount?: string;
  failureReason?: string;
}

/** 渠道日交易账单中的成功支付记录。 */
export interface ProviderTradeBillEntry {
  paymentNo: string;
  providerTradeNo: string;
  amount: string;
}

export interface PaymentProvider {
  readonly channel: PaymentChannel;
  createPayment(input: CreateProviderPaymentInput): Promise<Record<string, string>>;
  createRefund(input: CreateProviderRefundInput): Promise<CreateProviderRefundResult>;
  queryPayment(input: QueryProviderPaymentInput): Promise<QueryProviderPaymentResult>;
  downloadTradeBill(billDate: string): Promise<ProviderTradeBillEntry[]>;
}
