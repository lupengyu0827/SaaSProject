/** 退款状态。 */
export type RefundStatus = 'pending_review' | 'approved' | 'rejected' | 'succeeded' | 'failed';

/** 退款商品明细；金额由服务端订单快照计算。 */
export interface CreateRefundItemRequest {
  orderItemId: string;
  quantity: number;
}

/** 提交退款申请。 */
export interface CreateRefundRequest {
  idempotencyKey: string;
  reason: string;
  items: CreateRefundItemRequest[];
}

/** 审核退款申请。 */
export interface ReviewRefundRequest {
  approved: boolean;
  note?: string;
}

/** 支付渠道退款结果确认；eventId 用于保证回调幂等。 */
export interface ConfirmRefundRequest {
  eventId: string;
  providerRefundNo: string;
  refundedAmount: string;
  succeeded: boolean;
  failureReason?: string;
}

/** 退款渠道流水响应。 */
export interface RefundTransactionResponse {
  id: string;
  channel: import('./payment.js').PaymentChannel;
  status: 'pending' | 'succeeded' | 'failed';
  amount: string;
  providerRefundNo: string | null;
  failureReason: string | null;
  createdAt: string;
}

/** 退款商品明细响应。 */
export interface RefundItemResponse {
  id: string;
  orderItemId: string;
  quantity: number;
  amount: string;
}

/** 退款申请响应。 */
export interface RefundResponse {
  id: string;
  orderId: string;
  refundNo: string;
  status: RefundStatus;
  reason: string;
  amount: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  items: RefundItemResponse[];
  transactions: RefundTransactionResponse[];
}
