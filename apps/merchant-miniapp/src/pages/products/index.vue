<!-- 商家商品列表：按草稿、在售和下架状态组织经营入口，卡片化布局与消费者端对齐。 -->
<script setup lang="ts">
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import type { ProductResponse, ProductStatus } from '@saas/contracts';
import { ref, shallowRef } from 'vue';

import { createProductDraft, listProducts } from '../../api/modules/product.api';
import StatePanel from '../../components/common/StatePanel.vue';
import { useAppTheme } from '../../composables/use-app-theme';

const { themeClass } = useAppTheme();
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
  // 草稿进入编辑器，其余状态进入商品详情查看完整资料与经营操作。
  const path = product.status === 'draft' ? 'editor' : 'detail';
  void uni.navigateTo({
    url: `/pages/products/${path}?id=${encodeURIComponent(product.id)}`,
  });
}

onLoad(() => void loadProducts());
onShow(() => void loadProducts());
onPullDownRefresh(async () => {
  await loadProducts();
  uni.stopPullDownRefresh();
});
</script>

<template>
  <view class="page" :class="themeClass">
    <view class="page-header">
      <text class="eyebrow">PRODUCT WORKBENCH</text>
      <text class="title">商品管理</text>
    </view>

    <scroll-view class="tabs" scroll-x enable-flex :show-scrollbar="false">
      <view class="tab-list">
        <view
          v-for="status in statuses"
          :key="status.value"
          class="tab"
          :class="{ 'tab--active': activeStatus === status.value }"
          @click="handleSelectStatus(status.value)"
        >
          {{ status.label }}
        </view>
      </view>
    </scroll-view>

    <view class="create-btn" @click="handleCreate">
      <image class="create-icon" src="/static/merchant/plus.svg" mode="aspectFit" />
      <text>新建商品草稿</text>
    </view>

    <view v-if="errorMessage" class="state-area">
      <StatePanel
        eyebrow="LOAD ERROR"
        title="商品加载失败"
        :description="errorMessage"
        action-label="重新加载"
        @action="loadProducts"
      />
    </view>
    <view v-else-if="loading && !products.length" class="state-area">
      <StatePanel
        eyebrow="PREPARING"
        title="正在加载商品"
        description="正在安全读取商品资料，请稍候。"
      />
    </view>
    <view v-else-if="!products.length" class="state-area">
      <StatePanel
        eyebrow="EMPTY"
        title="当前状态暂无商品"
        description="新建草稿后即可开始编辑商品资料。"
      />
    </view>
    <view v-else class="product-list">
      <view
        v-for="product in products"
        :key="product.id"
        class="product-card"
        @click="handleOpen(product)"
      >
        <view class="product-main">
          <text class="product-name">{{ product.name || '未命名草稿' }}</text>
          <text class="product-code">{{ product.code }}</text>
        </view>
        <view class="product-side">
          <text class="price">¥ {{ product.minimumPrice }}</text>
          <text class="version">v{{ product.version }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '../../styles/tokens.scss';
.page {
  min-height: 100vh;
  padding: 24rpx 32rpx 48rpx;
  color: var(--theme-text);
  background: var(--theme-bg);
}
.page-header {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.eyebrow {
  color: var(--theme-accent);
  font-family: $font-mono;
  font-size: 20rpx;
  letter-spacing: 4rpx;
}
.title {
  color: var(--theme-text);
  font-family: $font-display;
  font-size: 44rpx;
  font-weight: 700;
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
  padding: 12rpx 28rpx;
  border: 1rpx solid var(--theme-border);
  border-radius: 999rpx;
  background: var(--theme-surface);
  color: var(--theme-text-secondary);
  font-size: 24rpx;
  white-space: nowrap;
}
.tab--active {
  border-color: var(--theme-accent);
  background: var(--theme-accent-soft);
  color: var(--theme-accent);
  font-weight: 600;
}
.create-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  margin: 24rpx 0;
  padding: 24rpx 0;
  border-radius: $radius-control;
  background: var(--theme-accent);
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
}
.create-icon {
  width: 32rpx;
  height: 32rpx;
}
.state-area {
  padding: 32rpx 0;
}
.product-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.product-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  padding: 28rpx 32rpx;
  border-radius: $radius-card;
  background: var(--theme-surface);
  box-shadow: $shadow-luxury;
}
.product-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}
.product-name {
  overflow: hidden;
  color: var(--theme-text);
  font-size: 28rpx;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.product-code {
  color: var(--theme-text-muted);
  font-family: $font-mono;
  font-size: 20rpx;
}
.product-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
}
.price {
  color: var(--theme-accent);
  font-family: $font-mono;
  font-size: 26rpx;
  font-weight: 700;
}
.version {
  color: var(--theme-text-muted);
  font-family: $font-mono;
  font-size: 20rpx;
}
</style>
