/** 物流状态。 */
export type ShipmentStatus = 'shipped' | 'delivered';

/** 发货商品明细；不传 items 时默认发出订单全部剩余数量。 */
export interface CreateShipmentItemRequest {
  orderItemId: string;
  quantity: number;
}

/** 创建物流单请求。 */
export interface CreateShipmentRequest {
  carrierCode: string;
  carrierName: string;
  trackingNo: string;
  items?: CreateShipmentItemRequest[];
}

/** 物流单商品明细。 */
export interface ShipmentItemResponse {
  id: string;
  orderItemId: string;
  quantity: number;
}

/** 物流单响应。 */
export interface ShipmentResponse {
  id: string;
  orderId: string;
  shipmentNo: string;
  carrierCode: string;
  carrierName: string;
  trackingNo: string;
  status: ShipmentStatus;
  shippedAt: string;
  deliveredAt: string | null;
  createdAt: string;
  items: ShipmentItemResponse[];
}
