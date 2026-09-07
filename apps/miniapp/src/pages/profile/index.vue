<!-- 我的页面：按 Figma my-profile 浅色帧还原，用户/积分/订单为动态数据，未接入前用 mock 降级。 -->
<script setup lang="ts">
import { computed, ref } from 'vue';

import { useAppTheme } from '../../composables/use-app-theme';
import { useSafeArea } from '../../composables/use-safe-area';

const { themeClass } = useAppTheme();
const { statusBarHeight } = useSafeArea();

/** 用户信息：契约接入前用 mock，字段可选以避免硬编码真实用户数据。 */
interface ProfileUser {
  nickname: string;
  vipLabel: string;
  points: number;
  avatarUrl: string | null;
}

const user = ref<ProfileUser>({
  nickname: '雅雅_Yolanda',
  vipLabel: '金卡会员 · GOLDEN VIP',
  points: 24500,
  avatarUrl: null,
});

const pointsText = computed(() => user.value.points.toLocaleString('en-US'));

const orderSteps = [
  { key: 'pending-pay', label: '待付款', icon: '/static/figma/profile/step-card.svg' },
  { key: 'pending-ship', label: '待发货', icon: '/static/figma/profile/step-box.svg' },
  { key: 'pending-receive', label: '待收货', icon: '/static/figma/profile/step-truck.svg' },
  { key: 'after-sale', label: '退换/售后', icon: '/static/figma/profile/step-refresh.svg' },
];

const menuItems = [
  { key: 'favorites', title: '专属收藏夹', caption: '12件宝贝', icon: '/static/figma/profile/menu-heart.svg' },
  { key: 'coupons', title: '尊享优惠券', caption: '2张未使用', icon: '/static/figma/profile/menu-tag.svg' },
  { key: 'address', title: '地址管理', caption: '默认：上海国金', icon: '/static/figma/profile/menu-pin.svg' },
  { key: 'points-mall', title: '积分兑换商城', caption: '新品好礼', icon: '/static/figma/profile/gift.svg' },
  { key: 'advisor', title: '在线顾问服务', caption: '极速响应', icon: '/static/figma/profile/menu-chat.svg' },
  { key: 'help', title: '帮助中心', caption: '常见问题答疑', icon: '/static/figma/profile/help.svg' },
];

function handleRedeem(): void {
  uni.showToast({ title: '积分兑礼待接入', icon: 'none' });
}

function handleViewAllOrders(): void {
  uni.showToast({ title: '订单列表待接入', icon: 'none' });
}

function handleOrderStep(step: (typeof orderSteps)[number]): void {
  uni.showToast({ title: `${step.label}待接入`, icon: 'none' });
}

function handleMenu(item: (typeof menuItems)[number]): void {
  uni.showToast({ title: `${item.title}待接入`, icon: 'none' });
}

function handleSettings(): void {
  uni.showToast({ title: '设置待接入', icon: 'none' });
}
</script>

<template>
  <view class="page" :class="themeClass">
    <view class="status-bar" :style="{ height: `${statusBarHeight}px` }" />
    <!-- 用户信息头 -->
    <view class="profile-header">
      <view class="avatar" :class="{ 'avatar--placeholder': !user.avatarUrl }">
        <image v-if="user.avatarUrl" class="avatar-img" :src="user.avatarUrl" mode="aspectFill" />
        <text v-else class="avatar-initial">{{ user.nickname.slice(0, 1) }}</text>
      </view>
      <view class="user-info">
        <text class="nickname">{{ user.nickname }}</text>
        <view class="vip-badge">{{ user.vipLabel }}</view>
      </view>
      <view class="settings-btn" @click="handleSettings">
        <image class="settings-icon" src="/static/figma/profile/settings.svg" mode="aspectFit" />
      </view>
    </view>

    <!-- 积分卡 -->
    <view class="points-card">
      <view class="points-info">
        <text class="points-label">当前账户积分</text>
        <text class="points-value">{{ pointsText }} 积分</text>
      </view>
      <view class="redeem-btn" @click="handleRedeem">去兑礼</view>
    </view>

    <!-- 订单状态卡 -->
    <view class="order-card">
      <view class="order-head">
        <text class="order-title">我的订单</text>
        <text class="order-more" @click="handleViewAllOrders">查看全部 ▾</text>
      </view>
      <view class="order-steps">
        <view
          v-for="step in orderSteps"
          :key="step.key"
          class="order-step"
          @click="handleOrderStep(step)"
        >
          <image class="step-icon" :src="step.icon" mode="aspectFit" />
          <text class="step-label">{{ step.label }}</text>
        </view>
      </view>
    </view>

    <!-- 菜单列表 -->
    <view class="menu-list">
      <view
        v-for="item in menuItems"
        :key="item.key"
        class="menu-item"
        @click="handleMenu(item)"
      >
        <image class="menu-icon" :src="item.icon" mode="aspectFit" />
        <text class="menu-title">{{ item.title }}</text>
        <text class="menu-caption">{{ item.caption }}</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@use '../../styles/tokens.scss' as *;
.page {
  min-height: 100vh;
  padding: 0 0 calc(48rpx + env(safe-area-inset-bottom));
  color: var(--theme-text);
  background: var(--theme-bg);
}
.status-bar {
  width: 100%;
}
.profile-header {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 16rpx 32rpx 24rpx;
}
.avatar {
  display: flex;
  width: 128rpx;
  height: 128rpx;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1rpx solid var(--theme-border);
  border-radius: 50%;
  background: var(--theme-surface);
}
.avatar-img {
  width: 100%;
  height: 100%;
}
.avatar-initial {
  color: var(--theme-accent);
  font-family: $font-display;
  font-size: 48rpx;
  font-weight: 700;
}
.user-info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 12rpx;
}
.nickname {
  color: var(--theme-text);
  font-size: 36rpx;
  font-weight: 700;
}
.vip-badge {
  align-self: flex-start;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  color: var(--theme-accent);
  background: var(--theme-accent-soft);
  font-size: 22rpx;
  font-weight: 600;
}
.settings-btn {
  display: flex;
  width: 64rpx;
  height: 64rpx;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}
.settings-icon {
  width: 40rpx;
  height: 40rpx;
}
.points-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 16rpx 32rpx 0;
  padding: 28rpx 32rpx;
  border-radius: 24rpx;
  background: var(--theme-surface);
}
.points-info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.points-label {
  color: var(--theme-text-secondary);
  font-size: 22rpx;
}
.points-value {
  color: var(--theme-accent);
  font-family: $font-mono;
  font-size: 36rpx;
  font-weight: 700;
}
.redeem-btn {
  padding: 14rpx 32rpx;
  border-radius: 999rpx;
  color: #ffffff;
  background: var(--theme-accent);
  font-size: 24rpx;
  font-weight: 600;
}
.order-card {
  margin: 16rpx 32rpx 0;
  padding: 28rpx 32rpx;
  border-radius: 24rpx;
  background: var(--theme-surface);
}
.order-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.order-title {
  color: var(--theme-text);
  font-size: 28rpx;
  font-weight: 700;
}
.order-more {
  color: var(--theme-text-muted);
  font-size: 22rpx;
}
.order-steps {
  display: flex;
  justify-content: space-between;
  margin-top: 28rpx;
}
.order-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}
.step-icon {
  width: 40rpx;
  height: 40rpx;
}
.step-label {
  color: var(--theme-text);
  font-size: 22rpx;
}
.menu-list {
  margin: 16rpx 32rpx 0;
  padding: 8rpx 32rpx;
  border-radius: 24rpx;
  background: var(--theme-surface);
}
.menu-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 28rpx 0;
  border-bottom: 1rpx solid var(--theme-border-soft);
}
.menu-item:last-child {
  border-bottom: 0;
}
.menu-icon {
  width: 36rpx;
  height: 36rpx;
  flex-shrink: 0;
}
.menu-title {
  flex: 1;
  color: var(--theme-text);
  font-size: 26rpx;
  font-weight: 500;
}
.menu-caption {
  color: var(--theme-text-muted);
  font-size: 22rpx;
}
.menu-arrow {
  color: var(--theme-text-muted);
  font-size: 32rpx;
}
</style>
