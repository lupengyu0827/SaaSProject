<!-- 商家商品列表：按草稿、在售和下架状态组织手机经营入口。 -->
<script setup lang="ts">
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import type { ProductResponse, ProductStatus } from '@saas/contracts';
import { ref, shallowRef } from 'vue';

import { createProductDraft, listProducts } from '../../api/modules/product.api';

const statuses: Array<{ label: string; value: ProductStatus }> = [
  { label: '草稿', value: 'draft' },
  { label: '在售', value: 'active' },
  { label: '下架', value: 'archived' },
];
const activeStatus = ref<ProductStatus>('draft');
const products = shallowRef<ProductResponse[]>([]);
const loading = ref(false);
const errorMessage = ref<string | null>(null);

async function loadProducts(): Promise<void> {
  if (loading.value) return;
  loading.value = true;
  errorMessage.value = null;
  try {
    const result = await listProducts({ status: activeStatus.value, page: 1, pageSize: 50 });
    products.value = result.list;
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '加载商品失败';
  } finally {
    loading.value = false;
  }
}

function handleSelectStatus(status: ProductStatus): void {
  activeStatus.value = status;
  void loadProducts();
}
async function handleCreate(): Promise<void> {
  try {
    const draft = await createProductDraft();
    await uni.navigateTo({ url: `/pages/products/editor?id=${encodeURIComponent(draft.id)}` });
  } catch (error: unknown) {
    void uni.showToast({
      title: error instanceof Error ? error.message : '创建草稿失败',
      icon: 'none',
    });
  }
}
function handleOpen(product: ProductResponse): void {
  if (product.status !== 'draft') {
    void uni.showToast({ title: '当前阶段仅开放草稿编辑', icon: 'none' });
    return;
  }
  void uni.navigateTo({ url: `/pages/products/editor?id=${encodeURIComponent(product.id)}` });
}

onLoad(() => void loadProducts());
onShow(() => void loadProducts());
onPullDownRefresh(async () => {
  await loadProducts();
  uni.stopPullDownRefresh();
});
</script>

<template>
  <view class="page-shell">
    <view class="heading"
      ><text class="eyebrow">PRODUCT WORKBENCH</text><text class="title">商品管理</text></view
    >
    <scroll-view class="tabs" scroll-x enable-flex
      ><view class="tab-list"
        ><button
          v-for="status in statuses"
          :key="status.value"
          class="tab"
          :class="{ 'tab--active': activeStatus === status.value }"
          @click="handleSelectStatus(status.value)"
        >
          {{ status.label }}
        </button></view
      ></scroll-view
    >
    <button class="primary" @click="handleCreate">新建商品草稿</button>
    <view v-if="errorMessage" class="state error" @click="loadProducts"
      >{{ errorMessage }} · 点击重试</view
    >
    <view v-else-if="loading && !products.length" class="state">正在加载商品…</view>
    <view v-else-if="!products.length" class="state">当前状态暂无商品</view>
    <view
      v-for="product in products"
      :key="product.id"
      class="product-row"
      @click="handleOpen(product)"
    >
      <view class="product-copy"
        ><text class="product-name">{{ product.name || '未命名草稿' }}</text
        ><text class="product-code">{{ product.code }}</text></view
      >
      <view class="product-side"
        ><text class="price">¥ {{ product.minimumPrice }}</text
        ><text class="version">v{{ product.version }}</text></view
      >
    </view>
  </view>
</template>

<style scoped lang="scss">
@use '../../styles/tokens.scss' as *;
.page-shell {
  min-height: 100vh;
  padding: 40rpx 32rpx;
  background: $bg-base;
}
.heading,
.product-copy,
.product-side {
  display: flex;
  flex-direction: column;
}
.eyebrow {
  color: $accent-gold;
  font-size: 20rpx;
  letter-spacing: 4rpx;
}
.title {
  margin-top: 12rpx;
  color: $text-primary;
  font-size: 44rpx;
  font-weight: 600;
}
.tabs {
  margin-top: 32rpx;
  white-space: nowrap;
}
.tab-list {
  display: flex;
  gap: 16rpx;
}
.tab {
  margin: 0;
  padding: 12rpx 28rpx;
  border: 2rpx solid $border-subtle;
  border-radius: 12rpx;
  background: $bg-surface;
  color: $text-secondary;
  font-size: 24rpx;
  white-space: nowrap;
}
.tab::after,
.primary::after {
  border: 0;
}
.tab--active {
  border-color: $accent-gold;
  background: $accent-champagne;
  color: $accent-gold;
}
.primary {
  margin: 32rpx 0;
  border-radius: 16rpx;
  background: $accent-gold;
  color: $bg-surface;
  font-size: 28rpx;
}
.state {
  padding: 64rpx 24rpx;
  color: $text-secondary;
  text-align: center;
}
.error {
  color: $status-danger;
}
.product-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  padding: 28rpx 0;
  border-bottom: 2rpx solid $border-subtle;
}
.product-copy {
  min-width: 0;
  flex: 1;
  gap: 8rpx;
}
.product-name {
  overflow: hidden;
  color: $text-primary;
  font-size: 28rpx;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.product-code,
.version {
  color: $text-secondary;
  font-size: 20rpx;
}
.product-side {
  align-items: flex-end;
  gap: 8rpx;
}
.price {
  color: $accent-gold;
  font-family: monospace;
  font-size: 24rpx;
}
</style>
