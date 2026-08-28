export type OrderStatus =
  'pending' | 'paid' | 'fulfilled' | 'partially_refunded' | 'refunded' | 'canceled' | 'expired';

export interface CreateOrderItemRequest {
  variantId: string;
  quantity: number;
}

export interface CreateOrderRequest {
  idempotencyKey: string;
  items: CreateOrderItemRequest[];
  customer?: Record<string, unknown>;
  shippingAddress: Record<string, unknown>;
  shippingFee?: string;
  discount?: string;
  remark?: string;
}

export interface CancelOrderRequest {
  reason?: string;
}

export interface OrderItemResponse {
  id: string;
  variantId: string;
  productName: string;
  sku: string;
  specs: unknown;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

export interface OrderResponse {
  id: string;
  orderNo: string;
  status: OrderStatus;
  customer: unknown;
  shippingAddress: unknown;
  subtotal: string;
  discount: string;
  shippingFee: string;
  total: string;
  remark: string | null;
  cancelReason: string | null;
  canceledAt: string | null;
  expiresAt: string;
  expiredAt: string | null;
  createdAt: string;
  items: OrderItemResponse[];
}

export interface OrderListQuery {
  status?: OrderStatus;
  cursor?: string;
  limit?: number;
}

export interface OrderPageResponse {
  items: OrderResponse[];
  nextCursor: string | null;
}

export interface ExpireOrdersRequest {
  limit?: number;
}

export interface ExpireOrdersResponse {
  scanned: number;
  expired: number;
  orderIds: string[];
}
