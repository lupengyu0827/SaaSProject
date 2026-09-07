<!-- 甄选页：按 Figma curated-selection 浅色帧还原，区块化陈列殿堂甄选与限定款式。 -->
<script setup lang="ts">
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app';
import type { PublicProductResponse } from '@saas/contracts';
import { computed, ref, shallowRef } from 'vue';

import { listActiveProducts } from '../../api/modules/product.api';
import HomeProductCard from '../../components/product/HomeProductCard.vue';
import { useAppTheme } from '../../composables/use-app-theme';
import { useSafeArea } from '../../composables/use-safe-area';

const PAGE_SIZE = 20;
const { themeClass } = useAppTheme();
const { statusBarHeight } = useSafeArea();

const products = shallowRef<PublicProductResponse[]>([]);
const isLoading = ref(false);
const errorMessage = ref<string | null>(null);

const firstCollection = computed(() => products.value.slice(0, 4));
const secondCollection = computed(() => products.value.slice(4, 8));

async function loadProducts(): Promise<void> {
  if (isLoading.value) return;
  isLoading.value = true;
  errorMessage.value = null;
  try {
    const page = await listActiveProducts({ pageSize: PAGE_SIZE });
    products.value = page.list;
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '加载甄选藏品失败，请稍后重试';
  } finally {
    isLoading.value = false;
  }
}

function handleOpenProduct(product: PublicProductResponse): void {
  void uni.navigateTo({ url: `/pages/product/detail?id=${encodeURIComponent(product.id)}` });
}

function handleExploreAll(): void {
  uni.showToast({ title: '全部甄选待接入', icon: 'none' });
}

function handleRetry(): void {
  void loadProducts();
}

onLoad(() => void loadProducts());
onPullDownRefresh(async () => {
  await loadProducts();
  uni.stopPullDownRefresh();
});
</script>

<template>
  <view class="page" :class="themeClass">
    <view class="status-bar" :style="{ height: `${statusBarHeight}px` }" />
    <view class="curated-header">
      <text class="brand-name">HARRY WINSTON</text>
      <text class="header-sub">THE CHOSEN COLLECTION · 殿堂甄选</text>
    </view>

    <view class="editorial-banner">
      <image class="banner-image" src="/static/figma/curated/hero-banner.png" mode="aspectFill" />
      <view class="banner-overlay" />
      <view class="banner-copy">
        <text class="banner-title">殿堂甄选 · 匠心之作</text>
        <text class="banner-desc">精雕细琢，将永恒之爱凝结在方寸之间。</text>
      </view>
    </view>

    <view v-if="isLoading" class="state-panel">
      <text>正在整理殿堂甄选…</text>
    </view>
    <view v-else-if="errorMessage" class="state-panel">
      <text>{{ errorMessage }}</text>
      <text class="retry-action" @click="handleRetry">重新加载</text>
    </view>

    <template v-else>
      <view v-if="firstCollection.length" class="collection-block">
        <view class="block-head">
          <text class="block-title">经典标志 · THE LOGO STORY</text>
          <text class="block-more" @click="handleExploreAll">探索全部 ▾</text>
        </view>
        <view class="product-row">
          <HomeProductCard
            v-for="product in firstCollection"
            :key="product.id"
            :product="product"
            @click="handleOpenProduct(product)"
          />
        </view>
      </view>

      <view v-if="secondCollection.length" class="collection-block">
        <view class="block-head">
          <text class="block-title">限定款式 · EXCLUSIVE EDITIONS</text>
          <text class="block-more" @click="handleExploreAll">探索全部 ▾</text>
        </view>
        <view class="product-row">
          <HomeProductCard
            v-for="product in secondCollection"
            :key="product.id"
            :product="product"
            @click="handleOpenProduct(product)"
          />
        </view>
      </view>

      <view v-if="!firstCollection.length && !secondCollection.length" class="state-panel">
        <text>暂无在售甄选藏品</text>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
@use '../../styles/tokens.scss' as *;
.page {
  min-height: 100vh;
  padding: 0 0 calc(72rpx + env(safe-area-inset-bottom));
  color: var(--theme-text);
  background: var(--theme-bg);
}
.status-bar {
  width: 100%;
}
.curated-header {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 8rpx;
  height: 88rpx;
  padding: 0 32rpx;
}
.brand-name {
  color: var(--theme-accent);
  font-family: $font-display;
  font-size: 36rpx;
  font-weight: 700;
  letter-spacing: 4rpx;
}
.header-sub {
  color: var(--theme-text-secondary);
  font-family: $font-display;
  font-size: 24rpx;
  letter-spacing: 2rpx;
}
.editorial-banner {
  position: relative;
  height: 440rpx;
  margin: 0 32rpx 40rpx;
  overflow: hidden;
  border-radius: 32rpx;
}
.banner-image,
.banner-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.banner-overlay {
  background: var(--theme-overlay);
}
.banner-copy {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 40rpx;
}
.banner-title {
  color: #ffffff;
  font-family: $font-display;
  font-size: 40rpx;
  font-weight: 700;
}
.banner-desc {
  color: rgba(255, 255, 255, 0.85);
  font-size: 24rpx;
}
.collection-block {
  padding: 0 32rpx 40rpx;
}
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}
.block-title {
  color: var(--theme-text);
  font-family: $font-display;
  font-size: 30rpx;
  font-weight: 700;
}
.block-more {
  color: var(--theme-accent);
  font-size: 22rpx;
}
.product-row {
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
