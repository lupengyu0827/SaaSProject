export type PaymentChannel = 'mock' | 'wechat_pay' | 'alipay' | 'stripe';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed';

export interface CreatePaymentRequest {
  orderId: string;
  channel: PaymentChannel;
  idempotencyKey: string;
}

export interface ConfirmPaymentRequest {
  eventId: string;
  paidAmount: string;
  providerTradeNo: string;
  succeeded: boolean;
  failureReason?: string;
}

export interface PaymentResponse {
  id: string;
  orderId: string;
  paymentNo: string;
  channel: PaymentChannel;
  status: PaymentStatus;
  amount: string;
  providerTradeNo: string | null;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface CreatePaymentCheckoutRequest {
  openId?: string;
}

export interface PaymentCheckoutResponse {
  paymentId: string;
  channel: PaymentChannel;
  payload: Record<string, string>;
}
