<!-- 消费者浅色首页：按 Figma homepage-light 还原，并通过语义 Token 预留多主题。 -->
<script setup lang="ts">
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app';
import type { PublicProductResponse } from '@saas/contracts';
import { computed, ref, shallowRef } from 'vue';

import { listActiveProducts } from '../../api/modules/product.api';
import HomeProductCard from '../../components/product/HomeProductCard.vue';
import { useAppTheme } from '../../composables/use-app-theme';
import { formatCurrency, getLowestPrice, getPrimaryImage } from '../../utils/product-view';

const PAGE_SIZE = 10;
const { themeClass } = useAppTheme();
const products = shallowRef<PublicProductResponse[]>([]);
const isLoading = ref(false);
const errorMessage = ref<string | null>(null);
const categoryItems = [
  { label: '戒指', icon: '/static/figma/home-light/ring.svg' },
  { label: '项链', icon: '/static/figma/home-light/jewel.svg' },
  { label: '耳饰', icon: '/static/figma/home-light/jewel.svg' },
  { label: '手链', icon: '/static/figma/home-light/jewel.svg' },
  { label: '腕表', icon: '/static/figma/home-light/watch.svg' },
  { label: '更多', icon: '/static/figma/home-light/layers.svg' },
] as const;
const popularProducts = computed(() => products.value.slice(0, 2));
const newProducts = computed(() => products.value.slice(2, 6));

/** 加载当前租户公开商品，页面不使用 Figma 示例假数据替代业务结果。 */
async function loadProducts(): Promise<void> {
  if (isLoading.value) return;
  isLoading.value = true;
  errorMessage.value = null;
  try {
    const page = await listActiveProducts({
      keyword: searchKeyword.value.trim() || undefined,
      pageSize: PAGE_SIZE,
    });
    products.value = page.list;
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '加载藏品失败，请稍后重试';
  } finally {
    isLoading.value = false;
  }
}

function handleOpenCollection(): void {
  void uni.switchTab({ url: '/pages/collection/index' });
}
function handleOpenSearch(keyword?: string): void {
  const url = keyword
    ? `/pages/search/index?keyword=${encodeURIComponent(keyword)}`
    : '/pages/search/index';
  void uni.navigateTo({ url });
}
function handleSelectCategory(label: string): void {
  if (label === '更多') return handleOpenCollection();
  handleOpenSearch(label);
}
function handleOpenProduct(product: PublicProductResponse): void {
  void uni.navigateTo({ url: `/pages/product/detail?id=${encodeURIComponent(product.id)}` });
}
function productImage(product: PublicProductResponse): string | null {
  return getPrimaryImage(product);
}
function productPrice(product: PublicProductResponse): string {
  const price = getLowestPrice(product);
  return price ? formatCurrency(price) : '价格待询';
}

onLoad(() => void loadProducts());
onPullDownRefresh(async () => {
  await loadProducts();
  uni.stopPullDownRefresh();
});
</script>

<template>
  <view class="page" :class="themeClass">
    <view class="homepage-header">
      <view class="location-pill">
        <image class="small-icon" src="/static/figma/home-light/map-pin.svg" mode="aspectFit" />
        <text>上海国金中心店⌄</text>
      </view>
      <text class="brand-name">HARRY WINSTON</text>
      <image class="scan-icon" src="/static/figma/home-light/scan.svg" mode="aspectFit" />
    </view>

    <view class="search-wrapper">
      <view class="search-shell" @click="handleOpenSearch">
        <image class="search-icon" src="/static/figma/home-light/search.svg" mode="aspectFit" />
        <text class="search-placeholder">搜索 经典钻戒、绝美对戒、经典链饰...</text>
      </view>
    </view>

    <view class="banner-section">
      <view class="hero-banner">
        <image class="hero-image" src="/static/figma/home-light/hero.png" mode="aspectFill" />
        <view class="hero-overlay" />
        <view class="banner-text">
          <text class="banner-kicker">FALL COLLECTION</text>
          <text class="banner-title">秋季雅致新作首发</text>
          <text class="banner-copy">优雅流线，承载每一刻暖意。部分单品享尊贵刻字服务。</text>
        </view>
        <view class="explore-pill" @click="handleOpenCollection">立即探索</view>
      </view>
    </view>

    <view class="categories-section">
      <view
        v-for="category in categoryItems"
        :key="category.label"
        class="category-item"
        @click="handleSelectCategory(category.label)"
      >
        <view class="category-icon-shell">
          <image class="category-icon" :src="category.icon" mode="aspectFit" />
        </view>
        <text>{{ category.label }}</text>
      </view>
    </view>

    <view class="content-section">
      <text class="section-title">热门推荐 · Popular Picks</text>
      <view v-if="popularProducts.length" class="product-grid">
        <HomeProductCard v-for="product in popularProducts" :key="product.id" :product="product" />
      </view>
      <view v-else class="state-panel">
        <text>{{ isLoading ? '正在整理臻品陈列…' : (errorMessage ?? '暂无在售藏品') }}</text>
        <text v-if="errorMessage" class="retry-action" @click="loadProducts">重新加载</text>
      </view>
    </view>

    <view v-if="newProducts.length" class="new-arrivals">
      <text class="section-title">新品速递 · Autumn Specials</text>
      <scroll-view class="arrival-scroll" scroll-x enable-flex :show-scrollbar="false">
        <view class="arrival-list">
          <view
            v-for="product in newProducts"
            :key="product.id"
            class="arrival-card"
            @click="handleOpenProduct(product)"
          >
            <image
              v-if="productImage(product)"
              class="arrival-image"
              :src="productImage(product) ?? ''"
              mode="aspectFill"
              lazy-load
            />
            <view v-else class="arrival-image arrival-placeholder">L</view>
            <view class="arrival-copy">
              <text class="arrival-name">{{ product.name }}</text>
              <text class="arrival-price">{{ productPrice(product) }}</text>
              <text class="arrival-action">查看详情⌄</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@use '../../styles/tokens.scss' as *;
.page {
  min-height: 100vh;
  padding: calc(env(safe-area-inset-top) + 88rpx) 0 48rpx;
  color: var(--theme-text);
  background: var(--theme-bg);
}
.homepage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 98rpx;
  padding: 16rpx 32rpx;
}
.location-pill {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 20rpx;
  border: 1rpx solid var(--theme-border);
  border-radius: 999rpx;
  color: var(--theme-text-secondary);
  background: var(--theme-surface);
  font-size: 22rpx;
  white-space: nowrap;
}
.small-icon {
  width: 24rpx;
  height: 24rpx;
}
.brand-name {
  color: var(--theme-accent);
  font-family: $font-display;
  font-size: 30rpx;
  font-weight: 700;
  white-space: nowrap;
}
.scan-icon {
  width: 40rpx;
  height: 40rpx;
}
.search-wrapper {
  padding: 8rpx 32rpx 24rpx;
}
.search-shell {
  display: flex;
  align-items: center;
  height: 80rpx;
  padding: 0 24rpx;
  border: 1rpx solid var(--theme-border);
  border-radius: 16rpx;
  background: var(--theme-surface);
}
.search-icon {
  width: 28rpx;
  height: 28rpx;
}
.search-input {
  min-width: 0;
  flex: 1;
  height: 80rpx;
  margin-left: 16rpx;
  color: var(--theme-text);
  font-size: 26rpx;
}
.search-placeholder {
  color: var(--theme-text-muted);
}
.banner-section {
  padding: 0 32rpx 32rpx;
}
.hero-banner {
  position: relative;
  height: 360rpx;
  overflow: hidden;
  border-radius: 32rpx;
}
.hero-image,
.hero-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.hero-overlay {
  background: var(--theme-overlay);
}
.banner-text {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 40rpx;
}
.banner-kicker,
.banner-title,
.banner-copy {
  display: block;
}
.banner-kicker {
  color: #f5ece1;
  font-family: $font-display;
  font-size: 28rpx;
  font-weight: 700;
}
.banner-title {
  color: #fff;
  font-family: $font-display;
  font-size: 44rpx;
  font-weight: 700;
}
.banner-copy {
  color: rgba(255, 255, 255, 0.82);
  font-size: 22rpx;
}
.explore-pill {
  position: absolute;
  bottom: 40rpx;
  left: 40rpx;
  z-index: 1;
  padding: 16rpx 28rpx;
  border-radius: 999rpx;
  color: #1c1917;
  background: #fff;
  font-size: 22rpx;
  font-weight: 700;
  white-space: nowrap;
}
.categories-section {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0 32rpx 40rpx;
}
.category-item {
  display: flex;
  width: 92rpx;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  color: var(--theme-text);
  font-size: 22rpx;
  white-space: nowrap;
}
.category-icon-shell {
  display: flex;
  width: 80rpx;
  height: 80rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx solid var(--theme-border);
  border-radius: 50%;
  background: var(--theme-surface);
}
.category-icon {
  width: 40rpx;
  height: 40rpx;
}
.content-section,
.new-arrivals {
  padding: 0 32rpx 40rpx;
}
.section-title {
  display: block;
  margin-bottom: 24rpx;
  color: var(--theme-text);
  font-family: $font-display;
  font-size: 32rpx;
  font-weight: 700;
}
.product-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24rpx;
}
.state-panel {
  display: flex;
  min-height: 240rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  color: var(--theme-text-secondary);
  font-size: 24rpx;
}
.retry-action {
  color: var(--theme-accent);
  font-weight: 600;
}
.arrival-scroll {
  width: calc(100% + 32rpx);
  white-space: nowrap;
}
.arrival-list {
  display: flex;
  gap: 24rpx;
  padding-right: 32rpx;
}
.arrival-card {
  display: flex;
  width: 520rpx;
  flex: 0 0 auto;
  align-items: center;
  gap: 24rpx;
  padding: 24rpx;
  border: 1rpx solid var(--theme-border);
  border-radius: 24rpx;
  background: var(--theme-surface);
}
.arrival-image {
  display: flex;
  width: 140rpx;
  height: 140rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  background: var(--theme-border-soft);
}
.arrival-placeholder {
  color: var(--theme-accent);
  font-family: $font-display;
  font-size: 48rpx;
}
.arrival-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}
.arrival-name {
  overflow: hidden;
  color: var(--theme-text);
  font-size: 24rpx;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.arrival-price {
  color: var(--theme-accent);
  font-size: 24rpx;
  font-weight: 700;
}
.arrival-action {
  color: var(--theme-text-secondary);
  font-size: 20rpx;
}
</style>
