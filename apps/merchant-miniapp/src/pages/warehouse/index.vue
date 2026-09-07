<!-- 商品入库：选择商品来源，录入商品并决定是否同步上架（骨架页）。 -->
<script setup lang="ts">
import { useAppTheme } from '../../composables/use-app-theme';

const { themeClass } = useAppTheme();
const statusBarHeight = uni.getSystemInfoSync().statusBarHeight ?? 20;

const sources = [
  {
    label: '自有商品入库',
    caption: '录入自有商品，可同步上架',
    icon: '/static/icons/product.png',
    route: '/pages/intake/form?ownership=owned&action=stock_and_publish',
  },
  {
    label: '寄卖商品入库',
    caption: '登记寄卖人、售价分成',
    icon: '/static/icons/consign.png',
    route: '/pages/intake/form?ownership=consigned',
  },
  {
    label: '同行收货入库',
    caption: '同行收件、定价上架',
    icon: '/static/icons/inventory.png',
    route: '/pages/intake/form?ownership=other',
  },
] as const;

function openSource(route: string): void {
  void uni.navigateTo({ url: route });
}
</script>

<template>
  <view class="page" :class="themeClass">
    <view class="nav" :style="{ paddingTop: `${statusBarHeight}px` }">
      <text class="nav-title">商品入库</text>
    </view>
    <view class="body">
      <view class="intro">
        <text class="intro-title">选择商品来源</text>
        <text class="intro-caption">录入商品后，可选择仅入库或直接同步上架</text>
      </view>
      <view class="source-list">
        <view
          v-for="source in sources"
          :key="source.label"
          class="source-card"
          @click="openSource(source.route)"
        >
          <view class="source-icon">
            <image class="source-img" :src="source.icon" mode="aspectFit" />
          </view>
          <view class="source-copy">
            <text class="source-label">{{ source.label }}</text>
            <text class="source-caption">{{ source.caption }}</text>
          </view>
          <text class="source-arrow">›</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '../../styles/tokens.scss';

.page {
  min-height: 100vh;
  color: var(--theme-text);
  background: var(--theme-bg);
}
.nav {
  display: flex;
  align-items: flex-end;
  height: 88rpx;
  padding: 0 32rpx 16rpx;
}
.nav-title {
  color: var(--theme-text);
  font-family: $font-display;
  font-size: 36rpx;
  font-weight: 700;
}
.body {
  padding: 16rpx 32rpx calc(48rpx + env(safe-area-inset-bottom));
}
.intro {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 8rpx 0 24rpx;
}
.intro-title {
  color: var(--theme-text);
  font-size: 30rpx;
  font-weight: 600;
}
.intro-caption {
  color: var(--theme-text-muted);
  font-size: 24rpx;
}
.source-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.source-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 32rpx;
  border-radius: $radius-card;
  background: var(--theme-surface);
  box-shadow: $shadow-luxury;
}
.source-icon {
  display: flex;
  width: 88rpx;
  height: 88rpx;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  background: var(--theme-accent-soft);
}
.source-img {
  width: 48rpx;
  height: 48rpx;
}
.source-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}
.source-label {
  color: var(--theme-text);
  font-size: 30rpx;
  font-weight: 600;
}
.source-caption {
  color: var(--theme-text-muted);
  font-size: 22rpx;
}
.source-arrow {
  color: var(--theme-text-muted);
  font-size: 40rpx;
  font-weight: 300;
}
</style>
