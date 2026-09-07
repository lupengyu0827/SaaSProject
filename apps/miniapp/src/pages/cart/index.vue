<!-- 购物车页：按 Figma shopping-cart 浅色帧视觉还原，纯前端 mock，数据源与结算属后端主开发职责。 -->
<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import type { CartItemResponse, CartResponse, PublicProductResponse } from '@saas/contracts';
import { computed, ref, shallowRef } from 'vue';

import { getCart } from '../../api/modules/cart.api';
import { listActiveProducts } from '../../api/modules/product.api';
import HomeProductCard from '../../components/product/HomeProductCard.vue';
import { useAppTheme } from '../../composables/use-app-theme';
import { useSafeArea } from '../../composables/use-safe-area';
import { formatCurrency } from '../../utils/product-view';

const { themeClass } = useAppTheme();
const { statusBarHeight } = useSafeArea();

const cart = shallowRef<CartResponse | null>(null);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);
const isManaging = ref(false);
const recommends = shallowRef<PublicProductResponse[]>([]);

const selectedTotalText = computed(() =>
  cart.value ? formatCurrency(cart.value.summary.selectedTotal) : '¥ 0.00',
);
const allSelected = computed(() => cart.value?.summary.allSelected ?? false);

async function loadCart(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = null;
  try {
    const [cartData, page] = await Promise.all([
      getCart(),
      listActiveProducts({ pageSize: 2 }),
    ]);
    cart.value = cartData;
    recommends.value = page.list;
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '加载购物车失败';
  } finally {
    isLoading.value = false;
  }
}

function toggleSelect(item: CartItemResponse): void {
  if (!cart.value) return;
  item.selected = !item.selected;
  recomputeSummary();
}

function toggleAll(): void {
  if (!cart.value) return;
  const next = !cart.value.summary.allSelected;
  cart.value.items.forEach((item) => (item.selected = next));
  recomputeSummary();
}

function changeQuantity(item: CartItemResponse, delta: number): void {
  if (!cart.value) return;
  const next = item.quantity + delta;
  if (next < 1) return;
  item.quantity = next;
  item.lineTotal = multiplyDecimal(item.unitPrice, next);
  recomputeSummary();
}

function recomputeSummary(): void {
  if (!cart.value) return;
  const selected = cart.value.items.filter((item) => item.selected);
  const count = selected.reduce((sum, item) => sum + item.quantity, 0);
  const total = selected.reduce((sum, item) => addDecimal(sum, item.lineTotal), '0');
  cart.value.summary = {
    selectedCount: count,
    selectedTotal: total,
    allSelected: selected.length === cart.value.items.length && cart.value.items.length > 0,
  };
}

function toggleManage(): void {
  isManaging.value = !isManaging.value;
}

function handleCheckout(): void {
  if (!cart.value?.summary.selectedCount) {
    uni.showToast({ title: '请先选择藏品', icon: 'none' });
    return;
  }
  uni.showToast({ title: '结算将在私域成交链路后上线', icon: 'none' });
}

function handleDelete(item: CartItemResponse): void {
  if (!cart.value) return;
  cart.value.items = cart.value.items.filter((entry) => entry.id !== item.id);
  recomputeSummary();
}

function handleOpenProduct(product: PublicProductResponse): void {
  void uni.navigateTo({ url: `/pages/product/detail?id=${encodeURIComponent(product.id)}` });
}

function handleGoShopping(): void {
  void uni.switchTab({ url: '/pages/collection/index' });
}

function handleRetry(): void {
  void loadCart();
}

function addDecimal(left: string, right: string): string {
  const [li = '0', ld = ''] = left.split('.');
  const [ri = '0', rd = ''] = right.split('.');
  const totalCents = Number(`${li}${ld.padEnd(2, '0').slice(0, 2)}`) + Number(`${ri}${rd.padEnd(2, '0').slice(0, 2)}`);
  const integer = Math.floor(totalCents / 100);
  const cents = String(totalCents % 100).padStart(2, '0');
  return `${integer}.${cents}`;
}

function multiplyDecimal(price: string, quantity: number): string {
  const [i = '0', d = ''] = price.split('.');
  const cents = Number(`${i}${d.padEnd(2, '0').slice(0, 2)}`) * quantity;
  const integer = Math.floor(cents / 100);
  const rem = String(cents % 100).padStart(2, '0');
  return `${integer}.${rem}`;
}

onLoad(() => void loadCart());
</script>

<template>
  <view class="page" :class="themeClass">
    <view class="status-bar" :style="{ height: `${statusBarHeight}px` }" />
    <view class="cart-header">
      <text class="cart-title">购物车 ({{ cart?.items.length ?? 0 }})</text>
      <text v-if="cart?.items.length" class="manage-btn" @click="toggleManage">
        {{ isManaging ? '完成' : '管理' }}
      </text>
    </view>

    <view v-if="isLoading" class="state-panel">
      <text>正在读取购物车…</text>
    </view>
    <view v-else-if="errorMessage" class="state-panel">
      <text>{{ errorMessage }}</text>
      <text class="retry-action" @click="handleRetry">重新加载</text>
    </view>
    <view v-else-if="!cart?.items.length" class="state-panel">
      <text>购物车还是空的</text>
      <text class="retry-action" @click="handleGoShopping">去逛逛甄选藏品</text>
    </view>

    <template v-else>
      <view class="cart-list">
        <view v-for="item in cart.items" :key="item.id" class="cart-item">
          <view
            class="checkbox"
            :class="{ 'checkbox--checked': item.selected }"
            @click="toggleSelect(item)"
          >
            <text v-if="item.selected" class="checkbox-mark">✓</text>
          </view>
          <image
            v-if="item.imageUrl"
            class="item-image"
            :src="item.imageUrl"
            mode="aspectFill"
          />
          <view v-else class="item-image item-placeholder">L</view>
          <view class="item-info">
            <text class="item-series">{{ item.seriesLabel }}</text>
            <text class="item-name">{{ item.productName }}</text>
            <text class="item-specs">{{ item.specsText }}</text>
            <view class="item-bottom">
              <text class="item-price">{{ formatCurrency(item.unitPrice) }}</text>
              <view v-if="!isManaging" class="qty-stepper">
                <text class="qty-btn" @click="changeQuantity(item, -1)">−</text>
                <text class="qty-value">{{ item.quantity }}</text>
                <text class="qty-btn" @click="changeQuantity(item, 1)">+</text>
              </view>
              <text v-else class="delete-btn" @click="handleDelete(item)">删除</text>
            </view>
          </view>
        </view>
      </view>

      <view class="checkout-box">
        <view class="select-all" @click="toggleAll">
          <view class="checkbox" :class="{ 'checkbox--checked': allSelected }">
            <text v-if="allSelected" class="checkbox-mark">✓</text>
          </view>
          <text class="select-all-label">全选</text>
        </view>
        <view class="checkout-right">
          <view class="total-info">
            <text class="total-label">合计</text>
            <text class="total-value">{{ selectedTotalText }}</text>
          </view>
          <view class="checkout-btn" @click="handleCheckout">
            结算 ({{ cart.summary.selectedCount }})
          </view>
        </view>
      </view>

      <view class="recommends">
        <text class="recommends-title">热销好礼推荐 · Best Sellers</text>
        <view class="recommends-grid">
          <HomeProductCard
            v-for="product in recommends"
            :key="product.id"
            :product="product"
            @click="handleOpenProduct(product)"
          />
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
@use '../../styles/tokens.scss' as *;
.page {
  min-height: 100vh;
  padding: 0 0 calc(140rpx + env(safe-area-inset-bottom));
  color: var(--theme-text);
  background: var(--theme-bg);
}
.status-bar {
  width: 100%;
}
.cart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 32rpx;
}
.cart-title {
  font-family: $font-display;
  font-size: 36rpx;
  font-weight: 700;
}
.manage-btn {
  color: var(--theme-accent);
  font-size: 26rpx;
}
.cart-list {
  margin: 0 32rpx;
  padding: 0 24rpx;
  border-radius: 24rpx;
  background: var(--theme-surface);
}
.cart-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx 0;
  border-bottom: 1rpx solid var(--theme-border-soft);
}
.cart-item:last-child {
  border-bottom: 0;
}
.checkbox {
  display: flex;
  width: 36rpx;
  height: 36rpx;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1rpx solid var(--theme-border);
  border-radius: 50%;
  background: var(--theme-surface);
}
.checkbox--checked {
  border-color: var(--theme-accent);
  background: var(--theme-accent);
}
.checkbox-mark {
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 700;
}
.item-image {
  display: flex;
  width: 144rpx;
  height: 144rpx;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  background: var(--theme-border-soft);
}
.item-placeholder {
  color: var(--theme-accent);
  font-family: $font-display;
  font-size: 48rpx;
}
.item-info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}
.item-series {
  color: var(--theme-accent);
  font-family: $font-display;
  font-size: 20rpx;
  font-weight: 700;
}
.item-name {
  overflow: hidden;
  color: var(--theme-text);
  font-size: 26rpx;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-specs {
  color: var(--theme-text-secondary);
  font-size: 22rpx;
}
.item-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4rpx;
}
.item-price {
  color: var(--theme-accent);
  font-family: $font-mono;
  font-size: 28rpx;
  font-weight: 700;
}
.qty-stepper {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.qty-btn {
  display: flex;
  width: 48rpx;
  height: 48rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx solid var(--theme-border);
  border-radius: 8rpx;
  color: var(--theme-text);
  font-size: 28rpx;
}
.qty-value {
  min-width: 32rpx;
  color: var(--theme-text);
  font-size: 26rpx;
  text-align: center;
}
.delete-btn {
  color: #c0392b;
  font-size: 24rpx;
}
.checkout-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 24rpx 32rpx 0;
  padding: 24rpx;
  border-radius: 24rpx;
  background: var(--theme-surface);
}
.select-all {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.select-all-label {
  color: var(--theme-text-secondary);
  font-size: 24rpx;
}
.checkout-right {
  display: flex;
  align-items: center;
  gap: 24rpx;
}
.total-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4rpx;
}
.total-label {
  color: var(--theme-text-secondary);
  font-size: 20rpx;
}
.total-value {
  color: var(--theme-accent);
  font-family: $font-mono;
  font-size: 32rpx;
  font-weight: 700;
}
.checkout-btn {
  padding: 20rpx 40rpx;
  border-radius: 999rpx;
  color: #ffffff;
  background: var(--theme-accent);
  font-size: 26rpx;
  font-weight: 600;
}
.recommends {
  padding: 40rpx 32rpx 0;
}
.recommends-title {
  display: block;
  margin-bottom: 24rpx;
  color: var(--theme-text);
  font-family: $font-display;
  font-size: 28rpx;
  font-weight: 700;
}
.recommends-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24rpx;
}
.state-panel {
  display: flex;
  min-height: 320rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  color: var(--theme-text-secondary);
  font-size: 26rpx;
}
.retry-action {
  color: var(--theme-accent);
  font-weight: 600;
}
</style>
