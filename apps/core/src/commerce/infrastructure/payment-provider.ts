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

export interface PaymentProvider {
  readonly channel: PaymentChannel;
  createPayment(input: CreateProviderPaymentInput): Promise<Record<string, string>>;
  createRefund(input: CreateProviderRefundInput): Promise<CreateProviderRefundResult>;
}
