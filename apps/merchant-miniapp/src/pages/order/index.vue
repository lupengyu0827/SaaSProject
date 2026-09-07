<!-- 开单：销售、寄卖、同行等业务开单入口（骨架页）。 -->
<script setup lang="ts">
import { useAppTheme } from '../../composables/use-app-theme';

const { themeClass } = useAppTheme();
const statusBarHeight = uni.getSystemInfoSync().statusBarHeight ?? 20;

const orderTypes = [
  { label: '销售开单', caption: '客户购买、收定金', icon: '/static/icons/order-list.svg' },
  { label: '寄卖开单', caption: '寄卖成交、分成结算', icon: '/static/icons/consign.svg' },
  { label: '同行开单', caption: '同行调货、对接结算', icon: '/static/icons/circle.svg' },
] as const;

function handleTodo(): void {
  uni.showToast({ title: '功能建设中，敬请期待', icon: 'none' });
}
</script>

<template>
  <view class="page" :class="themeClass">
    <view class="nav" :style="{ paddingTop: `${statusBarHeight}px` }">
      <text class="nav-title">开单</text>
    </view>
    <view class="body">
      <view class="intro">
        <text class="intro-title">选择业务类型</text>
        <text class="intro-caption">开单后自动联动库存、锁单与经营报表</text>
      </view>
      <view class="type-list">
        <view
          v-for="type in orderTypes"
          :key="type.label"
          class="type-card"
          @click="handleTodo"
        >
          <view class="type-icon">
            <image class="type-img" :src="type.icon" mode="aspectFit" />
          </view>
          <view class="type-copy">
            <text class="type-label">{{ type.label }}</text>
            <text class="type-caption">{{ type.caption }}</text>
          </view>
          <text class="type-arrow">›</text>
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
.type-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.type-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 32rpx;
  border-radius: $radius-card;
  background: var(--theme-surface);
  box-shadow: $shadow-luxury;
}
.type-icon {
  display: flex;
  width: 88rpx;
  height: 88rpx;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  background: var(--theme-accent-soft);
}
.type-img {
  width: 48rpx;
  height: 48rpx;
}
.type-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}
.type-label {
  color: var(--theme-text);
  font-size: 30rpx;
  font-weight: 600;
}
.type-caption {
  color: var(--theme-text-muted);
  font-size: 22rpx;
}
.type-arrow {
  color: var(--theme-text-muted);
  font-size: 40rpx;
  font-weight: 300;
}
</style>
