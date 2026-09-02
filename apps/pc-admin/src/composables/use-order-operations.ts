/** 订单运营组合式函数：编排列表筛选、游标分页和详情关联数据。 */
import { computed, shallowRef, type ComputedRef, type ShallowRef } from 'vue';
import type { OrderResponse, OrderStatus, RefundResponse, ShipmentResponse } from '@saas/contracts';

import { orderApi } from '../api/modules/order.api.js';

interface OrderOperations {
  orders: ShallowRef<OrderResponse[]>;
  selectedOrder: ShallowRef<OrderResponse | null>;
  shipments: ShallowRef<ShipmentResponse[]>;
  refunds: ShallowRef<RefundResponse[]>;
  loading: ShallowRef<boolean>;
  detailLoading: ShallowRef<boolean>;
  status: ShallowRef<OrderStatus | undefined>;
  canLoadMore: ComputedRef<boolean>;
  load: (reset?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  openDetail: (order: OrderResponse) => Promise<void>;
}

export function useOrderOperations(): OrderOperations {
  const orders = shallowRef<OrderResponse[]>([]);
  const selectedOrder = shallowRef<OrderResponse | null>(null);
  const shipments = shallowRef<ShipmentResponse[]>([]);
  const refunds = shallowRef<RefundResponse[]>([]);
  const loading = shallowRef(false);
  const detailLoading = shallowRef(false);
  const status = shallowRef<OrderStatus | undefined>();
  const cursor = shallowRef<string | undefined>();
  const nextCursor = shallowRef<string | null>(null);
  const canLoadMore = computed(() => nextCursor.value !== null);

  async function load(reset = true): Promise<void> {
    loading.value = true;
    try {
      if (reset) cursor.value = undefined;
      const page = await orderApi.list({ status: status.value, cursor: cursor.value, limit: 20 });
      orders.value = reset ? page.items : [...orders.value, ...page.items];
      nextCursor.value = page.nextCursor;
    } finally {
      loading.value = false;
    }
  }

  async function loadMore(): Promise<void> {
    if (!nextCursor.value) return;
    cursor.value = nextCursor.value;
    await load(false);
  }

  async function openDetail(order: OrderResponse): Promise<void> {
    selectedOrder.value = order;
    detailLoading.value = true;
    try {
      const [detail, shipmentList, refundList] = await Promise.all([
        orderApi.get(order.id),
        orderApi.shipments(order.id),
        orderApi.refunds(order.id),
      ]);
      selectedOrder.value = detail;
      shipments.value = shipmentList;
      refunds.value = refundList;
    } finally {
      detailLoading.value = false;
    }
  }

  return {
    orders,
    selectedOrder,
    shipments,
    refunds,
    loading,
    detailLoading,
    status,
    canLoadMore,
    load,
    loadMore,
    openDetail,
  };
}
