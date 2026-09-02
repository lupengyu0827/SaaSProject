/** 订单运营 API：页面只依赖共享契约，不接触 HTTP 实现。 */
import type {
  CancelOrderRequest,
  CreateRefundRequest,
  CreateShipmentRequest,
  OrderListQuery,
  OrderPageResponse,
  OrderResponse,
  RefundResponse,
  ShipmentResponse,
  ReplayWebhookResponse,
  WebhookDeadLetterResponse,
  WebhookEventKind,
} from '@saas/contracts';

import { requestApi } from '../client.js';

export const orderApi = {
  list(query: OrderListQuery): Promise<OrderPageResponse> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) search.set(key, String(value));
    return requestApi(`/orders?${search.toString()}`);
  },
  get(id: string): Promise<OrderResponse> {
    return requestApi(`/orders/${id}`);
  },
  cancel(id: string, input: CancelOrderRequest): Promise<OrderResponse> {
    return requestApi(`/orders/${id}/cancel`, { method: 'POST', body: input });
  },
  shipments(id: string): Promise<ShipmentResponse[]> {
    return requestApi(`/orders/${id}/shipments`);
  },
  createShipment(id: string, input: CreateShipmentRequest): Promise<ShipmentResponse> {
    return requestApi(`/orders/${id}/shipments`, { method: 'POST', body: input });
  },
  refunds(id: string): Promise<RefundResponse[]> {
    return requestApi(`/orders/${id}/refunds`);
  },
  createRefund(id: string, input: CreateRefundRequest): Promise<RefundResponse> {
    return requestApi(`/orders/${id}/refunds`, { method: 'POST', body: input });
  },
  deadLetters(): Promise<WebhookDeadLetterResponse[]> {
    return requestApi('/webhook-dead-letters');
  },
  replayDeadLetter(kind: WebhookEventKind, id: string): Promise<ReplayWebhookResponse> {
    return requestApi(`/webhook-dead-letters/${kind}/${id}/replay`, { method: 'POST' });
  },
};
