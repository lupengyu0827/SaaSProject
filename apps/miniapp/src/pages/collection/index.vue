<!-- 消费者藏品目录：使用真实公开商品接口完成搜索、分页和弱网重试。 -->
<script setup lang="ts">
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import type { PublicProductResponse } from '@saas/contracts';
import { computed, ref, shallowRef } from 'vue';

import { listActiveProducts } from '../../api/modules/product.api';
import StatePanel from '../../components/common/StatePanel.vue';
import ProductCard from '../../components/product/ProductCard.vue';

const PAGE_SIZE = 10;
const products = shallowRef<PublicProductResponse[]>([]);
const keyword = ref('');
const nextPage = ref(1);
const total = ref(0);
const isLoading = ref(false);
const errorMessage = ref<string | null>(null);
const hasMore = computed(() => products.value.length < total.value);
const resultCaption = computed(() =>
  keyword.value.trim() ? `“${keyword.value.trim()}” 的搜索结果` : `当前在售 ${total.value} 件`,
);

/** 加载公开商品目录；刷新时替换，翻页时按 ID 去重追加。 */
async function loadProducts(reset = false): Promise<void> {
  if (isLoading.value) return;
  isLoading.value = true;
  errorMessage.value = null;
  const targetPage = reset ? 1 : nextPage.value;
  try {
    const result = await listActiveProducts({
      page: targetPage,
      pageSize: PAGE_SIZE,
      keyword: keyword.value.trim() || undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    products.value = reset ? result.list : appendUnique(products.value, result.list);
    total.value = result.total;
    nextPage.value = targetPage + 1;
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '加载藏品失败，请稍后重试';
  } finally {
    isLoading.value = false;
  }
}

function handleSearch(): void {
  void loadProducts(true);
}
function handleClearSearch(): void {
  keyword.value = '';
  void loadProducts(true);
}
function handleRetry(): void {
  void loadProducts(products.value.length === 0);
}
function appendUnique(
  current: PublicProductResponse[],
  incoming: PublicProductResponse[],
): PublicProductResponse[] {
  const knownIds = new Set(current.map(({ id }) => id));
  return [...current, ...incoming.filter(({ id }) => !knownIds.has(id))];
}

onLoad(() => void loadProducts(true));
onPullDownRefresh(async () => {
  await loadProducts(true);
  uni.stopPullDownRefresh();
});
onReachBottom(() => {
  if (hasMore.value) void loadProducts();
});
</script>

<template>
  <view class="page">
    <view class="page-header">
      <text class="header-kicker">THE COLLECTION</text>
      <text class="header-title">传世典藏</text>
      <text class="header-copy">仅呈现当前店铺已公开且仍在售的真实藏品。</text>
      <view class="search-shell">
        <text class="search-symbol">⌕</text>
        <input
          v-model="keyword"
          class="search-input"
          confirm-type="search"
          placeholder="搜索名称、编号或 SKU"
          placeholder-class="search-placeholder"
          @confirm="handleSearch"
        />
        <text v-if="keyword" class="clear-action" @click="handleClearSearch">清除</text>
      </view>
    </view>

    <view v-if="products.length" class="catalog-content">
      <view class="result-heading">
        <text class="result-caption">{{ resultCaption }}</text>
        <text class="result-count">{{ products.length }} / {{ total }}</text>
      </view>
      <ProductCard v-for="product in products" :key="product.id" :product="product" />
      <view class="list-footer">
        <text v-if="isLoading">正在读取更多藏品…</text>
        <text v-else-if="hasMore">继续上拉浏览</text>
        <text v-else>已呈现全部在售藏品</text>
      </view>
    </view>

    <StatePanel
      v-else-if="isLoading"
      eyebrow="CURATING"
      title="正在整理典藏目录"
      description="商品资料正在从店铺安全读取中。"
    />
    <StatePanel
      v-else-if="errorMessage"
      eyebrow="NETWORK NOTICE"
      title="暂时无法读取藏品"
      :description="errorMessage"
      action-label="重新加载"
      @action="handleRetry"
    />
    <StatePanel
      v-else
      eyebrow="COLLECTION UPDATE"
      title="暂时没有匹配藏品"
      description="换个关键词，或稍后等待店铺发布新藏品。"
      action-label="查看全部"
      @action="handleClearSearch"
    />
  </view>
</template>

<style scoped lang="scss">
@use '../../styles/tokens.scss' as *;
.page {
  min-height: 100vh;
  padding-bottom: calc(72rpx + env(safe-area-inset-bottom));
  background: $bg-dark-base;
}
.page-header {
  padding: calc(env(safe-area-inset-top) + 96rpx) 32rpx 40rpx;
  border-bottom: 1rpx solid $border-subtle;
}
.header-kicker,
.header-title,
.header-copy,
.result-caption,
.result-count {
  display: block;
}
.header-kicker,
.result-count {
  color: $accent-gold-light;
  font-family: $font-mono;
  font-size: 18rpx;
  letter-spacing: 3rpx;
}
.header-title {
  margin-top: 12rpx;
  color: $text-primary;
  font-family: $font-display;
  font-size: 48rpx;
}
.header-copy {
  margin-top: 12rpx;
  color: $text-secondary;
  font-size: 24rpx;
  line-height: 1.7;
}
.search-shell {
  display: flex;
  align-items: center;
  height: 88rpx;
  margin-top: 32rpx;
  padding: 0 24rpx;
  border: 1rpx solid $border-subtle;
  border-radius: $radius-control;
  background: $bg-surface;
}
.search-symbol {
  color: $accent-primary;
  font-size: 32rpx;
}
.search-input {
  flex: 1;
  height: 88rpx;
  margin-left: 16rpx;
  color: $text-primary;
  font-size: 26rpx;
}
.search-placeholder {
  color: $text-secondary;
}
.clear-action {
  padding-left: 24rpx;
  color: $accent-gold-light;
  font-size: 22rpx;
  white-space: nowrap;
}
.catalog-content {
  padding: 32rpx 24rpx;
}
.result-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.result-caption {
  color: $text-secondary;
  font-size: 24rpx;
}
.catalog-content :deep(.product-card) {
  margin-bottom: 24rpx;
}
.list-footer {
  padding: 24rpx 0 40rpx;
  color: $text-secondary;
  font-size: 22rpx;
  text-align: center;
}
</style>
