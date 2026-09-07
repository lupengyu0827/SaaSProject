<script setup lang="ts">
/** B4 订单运营工作台：筛选、详情时间线、取消、发货与退款申请。 */
import { computed, onMounted, reactive, shallowRef } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { OrderResponse, OrderStatus, RefundResponse, RefundStatus } from '@saas/contracts';

import { orderApi } from '../../api/modules/order.api.js';
import { useOrderOperations } from '../../composables/use-order-operations.js';

const {
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
} = useOrderOperations();
const drawerVisible = shallowRef(false);
const shipmentVisible = shallowRef(false);
const submitting = shallowRef(false);
const shipmentDraft = reactive({ carrierCode: 'SF', carrierName: '顺丰速运', trackingNo: '' });

const statusOptions: Array<{ label: string; value?: OrderStatus }> = [
  { label: '全部' },
  { label: '待支付', value: 'pending' },
  { label: '已支付', value: 'paid' },
  { label: '已发货', value: 'fulfilled' },
  { label: '部分退款', value: 'partially_refunded' },
  { label: '已退款', value: 'refunded' },
  { label: '已取消', value: 'canceled' },
];
const statusLabels: Record<OrderStatus, string> = {
  pending: '待支付',
  paid: '已支付',
  fulfilled: '已发货',
  partially_refunded: '部分退款',
  refunded: '已退款',
  canceled: '已取消',
  expired: '已过期',
};
const statusTypes: Record<OrderStatus, 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
  pending: 'warning',
  paid: 'success',
  fulfilled: 'primary',
  partially_refunded: 'warning',
  refunded: 'info',
  canceled: 'info',
  expired: 'danger',
};
const refundStatusLabels: Record<RefundStatus, string> = {
  pending_review: '待审核',
  approved: '已通过',
  rejected: '已驳回',
  succeeded: '退款成功',
  failed: '退款失败',
};
const refundStatusTypes: Record<RefundStatus, 'warning' | 'success' | 'danger' | 'info' | 'primary'> = {
  pending_review: 'warning',
  approved: 'primary',
  rejected: 'info',
  succeeded: 'success',
  failed: 'danger',
};
const refundPendingId = shallowRef<string | null>(null);
const timeline = computed(() => {
  const order = selectedOrder.value;
  if (!order) return [];
  const items = [{ time: order.createdAt, title: '订单创建', detail: `订单号 ${order.orderNo}` }];
  for (const shipment of shipments.value)
    items.push({
      time: shipment.shippedAt,
      title: '订单发货',
      detail: `${shipment.carrierName} · ${shipment.trackingNo}`,
    });
  for (const refund of refunds.value)
    items.push({
      time: refund.createdAt,
      title: '退款申请',
      detail: `¥ ${refund.amount} · ${refund.status}`,
    });
  if (order.canceledAt)
    items.push({
      time: order.canceledAt,
      title: '订单取消',
      detail: order.cancelReason ?? '未填写原因',
    });
  if (order.expiredAt)
    items.push({ time: order.expiredAt, title: '订单过期', detail: '系统超时关闭' });
  return items.sort((left, right) => left.time.localeCompare(right.time));
});

async function handleStatusChange(value: OrderStatus | undefined): Promise<void> {
  status.value = value;
  await handleLoad();
}

async function handleLoad(): Promise<void> {
  try {
    await load();
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  }
}

async function handleOpen(row: OrderResponse): Promise<void> {
  drawerVisible.value = true;
  try {
    await openDetail(row);
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  }
}

async function handleCancel(): Promise<void> {
  const order = selectedOrder.value;
  if (!order) return;
  const reason = await ElMessageBox.prompt('请输入取消原因', '取消订单', {
    inputPattern: /\S+/,
    inputErrorMessage: '取消原因不能为空',
  });
  submitting.value = true;
  try {
    await orderApi.cancel(order.id, { reason: reason.value });
    ElMessage.success('订单已取消');
    drawerVisible.value = false;
    await load();
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  } finally {
    submitting.value = false;
  }
}

async function handleShipment(): Promise<void> {
  const order = selectedOrder.value;
  if (!order || !shipmentDraft.trackingNo.trim()) {
    ElMessage.warning('请输入物流单号');
    return;
  }
  submitting.value = true;
  try {
    await orderApi.createShipment(order.id, { ...shipmentDraft });
    ElMessage.success('发货成功');
    shipmentVisible.value = false;
    await openDetail(order);
    await load();
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  } finally {
    submitting.value = false;
  }
}

async function handleRefund(): Promise<void> {
  const order = selectedOrder.value;
  if (!order) return;
  await ElMessageBox.confirm('将为订单全部商品提交退款申请，之后仍需审核。', '提交整单退款');
  submitting.value = true;
  try {
    await orderApi.createRefund(order.id, {
      idempotencyKey: `admin-${crypto.randomUUID()}`,
      reason: '管理后台整单退款',
      items: order.items.map((item) => ({ orderItemId: item.id, quantity: item.quantity })),
    });
    ElMessage.success('退款申请已提交');
    await openDetail(order);
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  } finally {
    submitting.value = false;
  }
}

async function handleReviewRefund(refund: RefundResponse, approved: boolean): Promise<void> {
  const order = selectedOrder.value;
  if (!order) return;
  const note = approved
    ? undefined
    : (await ElMessageBox.prompt('请输入驳回原因', '驳回退款', {
        inputPattern: /\S+/,
        inputErrorMessage: '驳回原因不能为空',
      })).value;
  refundPendingId.value = refund.id;
  try {
    await orderApi.reviewRefund(refund.id, { approved, note });
    ElMessage.success(approved ? '退款已通过审核' : '退款已驳回');
    await openDetail(order);
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  } finally {
    refundPendingId.value = null;
  }
}

async function handleExecuteRefund(refund: RefundResponse): Promise<void> {
  const order = selectedOrder.value;
  if (!order) return;
  await ElMessageBox.confirm(`确认执行退款 ¥ ${refund.amount}？此操作将触发渠道退款。`, '执行退款');
  refundPendingId.value = refund.id;
  try {
    await orderApi.executeRefund(refund.id);
    ElMessage.success('退款已执行');
    await openDetail(order);
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  } finally {
    refundPendingId.value = null;
  }
}

function getRefundStatusLabel(refund: RefundResponse): string {
  return refundStatusLabels[refund.status];
}
function getRefundStatusType(refund: RefundResponse): (typeof refundStatusTypes)[RefundStatus] {
  return refundStatusTypes[refund.status];
}

function readMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败';
}
function formatTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}
function getStatusLabel(order: OrderResponse): string {
  return statusLabels[order.status];
}
function getStatusType(order: OrderResponse): (typeof statusTypes)[OrderStatus] {
  return statusTypes[order.status];
}
onMounted(() => void handleLoad());
</script>

<template>
  <section aria-labelledby="orders-title" class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 id="orders-title" class="text-xl font-medium text-[var(--pc-text-primary)]">订单运营工作台</h1>
        <p class="mt-2 text-sm text-[var(--pc-text-secondary)]">统一处理订单履约、退款与异常追踪。</p>
      </div>
      <el-button :loading="loading" @click="handleLoad">刷新数据</el-button>
    </div>

    <div class="flex flex-wrap gap-2 border-b border-[var(--pc-border)] pb-3">
      <el-button
        v-for="option in statusOptions"
        :key="option.label"
        class="whitespace-nowrap"
        :type="status === option.value ? 'primary' : 'default'"
        @click="handleStatusChange(option.value)"
        >{{ option.label }}</el-button
      >
    </div>

    <el-card shadow="never">
      <el-table
        v-loading="loading"
        :data="orders"
        empty-text="暂无符合条件的订单"
        @row-click="handleOpen"
      >
        <el-table-column label="订单号" min-width="190">
          <template #default="{ row }"><span class="font-mono text-sm">{{ row.orderNo }}</span></template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag class="whitespace-nowrap" :type="getStatusType(row)">{{ getStatusLabel(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="items.length" label="商品数" width="90" />
        <el-table-column label="订单金额" width="140">
          <template #default="{ row }"
            ><span class="font-mono font-semibold text-[var(--pc-primary)]">¥ {{ row.total }}</span></template
          >
        </el-table-column>
        <el-table-column label="创建时间" width="190">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }"
            ><el-button link type="primary" @click.stop="handleOpen(row)">查看</el-button></template
          >
        </el-table-column>
      </el-table>
      <div class="mt-4 flex justify-center border-t border-[var(--pc-border)] pt-4">
        <el-button v-if="canLoadMore" :loading="loading" @click="loadMore">加载更多</el-button>
        <span v-else class="text-sm text-[var(--pc-text-secondary)]">已加载全部订单</span>
      </div>
    </el-card>

    <el-drawer v-model="drawerVisible" size="720px" title="订单详情">
      <div v-loading="detailLoading" class="space-y-6">
        <template v-if="selectedOrder">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--pc-border)] pb-4">
            <div>
              <p class="font-mono text-lg font-semibold text-[var(--pc-text-primary)]">{{ selectedOrder.orderNo }}</p>
              <p class="mt-1 text-sm text-[var(--pc-text-secondary)]">
                ¥ {{ selectedOrder.total }} · {{ selectedOrder.items.length }} 件商品
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <el-button v-if="selectedOrder.status === 'pending'" :loading="submitting" @click="handleCancel"
                >取消订单</el-button
              >
              <el-button v-if="selectedOrder.status === 'paid'" type="primary" @click="shipmentVisible = true"
                >发货</el-button
              >
              <el-button
                v-if="['paid', 'fulfilled', 'partially_refunded'].includes(selectedOrder.status)"
                type="warning"
                :loading="submitting"
                @click="handleRefund"
                >申请退款</el-button
              >
            </div>
          </div>
          <el-table :data="selectedOrder.items">
            <el-table-column prop="productName" label="商品" min-width="180" />
            <el-table-column prop="sku" label="SKU" width="130" />
            <el-table-column prop="quantity" label="数量" width="70" />
            <el-table-column label="小计" width="110">
              <template #default="{ row }">¥ {{ row.lineTotal }}</template>
            </el-table-column>
          </el-table>
          <div v-if="refunds.length">
            <h2 class="mb-4 text-base font-medium text-[var(--pc-text-primary)]">退款记录</h2>
            <el-table :data="refunds" empty-text="暂无退款记录">
              <el-table-column label="退款单号" min-width="180">
                <template #default="{ row }"><span class="font-mono text-sm">{{ row.refundNo }}</span></template>
              </el-table-column>
              <el-table-column label="金额" width="130">
                <template #default="{ row }"
                  ><span class="font-mono font-semibold text-[var(--pc-primary)]">¥ {{ row.amount }}</span></template
                >
              </el-table-column>
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <el-tag class="whitespace-nowrap" :type="getRefundStatusType(row)">{{ getRefundStatusLabel(row) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="reason" label="原因" min-width="180" show-overflow-tooltip />
              <el-table-column label="操作" width="180" fixed="right">
                <template #default="{ row }">
                  <template v-if="row.status === 'pending_review'">
                    <el-button
                      link
                      type="success"
                      :loading="refundPendingId === row.id"
                      @click="handleReviewRefund(row, true)"
                      >通过</el-button
                    >
                    <el-button
                      link
                      type="danger"
                      :loading="refundPendingId === row.id"
                      @click="handleReviewRefund(row, false)"
                      >驳回</el-button
                    >
                  </template>
                  <el-button
                    v-else-if="row.status === 'approved'"
                    link
                    type="primary"
                    :loading="refundPendingId === row.id"
                    @click="handleExecuteRefund(row)"
                    >执行退款</el-button
                  >
                </template>
              </el-table-column>
            </el-table>
          </div>
          <div>
            <h2 class="mb-4 text-base font-medium text-[var(--pc-text-primary)]">订单时间线</h2>
            <el-timeline>
              <el-timeline-item
                v-for="item in timeline"
                :key="`${item.time}-${item.title}`"
                :timestamp="formatTime(item.time)"
              >
                <p class="font-medium text-[var(--pc-text-primary)]">{{ item.title }}</p>
                <p class="mt-1 text-sm text-[var(--pc-text-secondary)]">{{ item.detail }}</p>
              </el-timeline-item>
            </el-timeline>
          </div>
        </template>
      </div>
    </el-drawer>

    <el-dialog v-model="shipmentVisible" title="创建物流单" width="520px">
      <el-form label-position="right" label-width="100px">
        <el-form-item label="物流公司">
          <el-select v-model="shipmentDraft.carrierCode" filterable class="w-full">
            <el-option label="顺丰速运" value="SF" />
          </el-select>
        </el-form-item>
        <el-form-item label="物流名称"><el-input v-model="shipmentDraft.carrierName" /></el-form-item>
        <el-form-item label="物流单号"><el-input v-model="shipmentDraft.trackingNo" maxlength="100" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shipmentVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleShipment">确认发货</el-button>
      </template>
    </el-dialog>
  </section>
</template>
