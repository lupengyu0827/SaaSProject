<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { getMerchantSession, logoutMerchant } from '../../api/modules/auth.api';
import { getMerchantAccessToken } from '../../config/runtime';
import { useMerchantSessionStore } from '../../stores/use-merchant-session-store';

const sessionStore = useMerchantSessionStore();
const loading = ref(true);
const merchantName = computed(() => sessionStore.currentMerchant?.displayName ?? '店铺成员');
const environmentMessage = computed(() =>
  sessionStore.currentTenant ? sessionStore.currentTenant.name : '正在确认店铺身份',
);

/** 退出商家工作台。 */
async function handleLogout(): Promise<void> {
  await logoutMerchant();
  sessionStore.clear();
  await uni.reLaunch({ url: '/pages/auth/login' });
}

/** 进入商品图片上传工作台。 */
function handleOpenMediaUpload(): void {
  void uni.navigateTo({ url: '/pages/media/upload' });
}

/** 进入 S2 商品草稿、预览和发布工作流。 */
function handleOpenProducts(): void {
  void uni.navigateTo({ url: '/pages/products/index' });
}

onMounted(async () => {
  if (!getMerchantAccessToken()) {
    await uni.reLaunch({ url: '/pages/auth/login' });
    return;
  }
  try {
    sessionStore.setContext(await getMerchantSession());
  } catch {
    sessionStore.clear();
    await uni.reLaunch({ url: '/pages/auth/login' });
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <view class="page-shell">
    <view class="page-heading">
      <view>
        <text class="eyebrow">MERCHANT CONSOLE</text>
        <text class="title">店铺工作台</text>
      </view>
      <view class="identity-badge">
        <text class="identity-name">{{ merchantName }}</text>
        <text class="identity-status">已认证</text>
      </view>
    </view>

    <view class="store-summary">
      <text class="summary-kicker">CURRENT STORE</text>
      <text class="summary-title">{{ environmentMessage }}</text>
      <text class="summary-copy">商品资料、图片与发布状态将在消费者端同步展示</text>
    </view>

    <view v-if="!loading" class="workspace-menu">
      <view class="menu-item" @click="handleOpenProducts">
        <text class="menu-index">01</text>
        <view class="menu-copy">
          <text class="menu-title">商品管理</text>
          <text class="menu-description">创建草稿、完善资料并检查发布</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="handleOpenMediaUpload">
        <text class="menu-index">02</text>
        <view class="menu-copy">
          <text class="menu-title">图片工作台</text>
          <text class="menu-description">拍照、多图上传与失败重试</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
    </view>
    <view v-else class="loading-state">正在加载店铺权限…</view>
    <button v-if="!loading" class="logout" @click="handleLogout">退出当前账号</button>
  </view>
</template>

<style scoped lang="scss">
@use '../../styles/tokens.scss' as *;

.page-shell {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 56rpx 32rpx calc(48rpx + env(safe-area-inset-bottom));
  background: $bg-base;
}

.page-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}

.eyebrow {
  color: $accent-gold;
  font-size: 20rpx;
  letter-spacing: 4rpx;
}

.title {
  display: block;
  margin-top: 12rpx;
  color: $text-primary;
  font-size: 48rpx;
  font-weight: 600;
}

.identity-badge {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6rpx;
}

.identity-name {
  max-width: 200rpx;
  overflow: hidden;
  color: $text-primary;
  font-size: 24rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.identity-status,
.summary-kicker {
  color: $accent-gold;
  font-size: 18rpx;
  letter-spacing: 2rpx;
}

.summary-copy,
.menu-description {
  color: $text-secondary;
  font-size: 24rpx;
  line-height: 1.6;
}

.store-summary {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 48rpx;
  padding: 32rpx 0;
  border-top: 2rpx solid $border-subtle;
  border-bottom: 2rpx solid $border-subtle;
}

.summary-title {
  color: $text-primary;
  font-size: 36rpx;
  font-weight: 600;
}

.workspace-menu {
  margin-top: 32rpx;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 32rpx 0;
  border-bottom: 2rpx solid $border-subtle;
}

.menu-index {
  color: $accent-gold;
  font-family: monospace;
  font-size: 22rpx;
}

.menu-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}

.menu-title {
  color: $text-primary;
  font-size: 30rpx;
  font-weight: 600;
}

.menu-arrow {
  color: $accent-gold;
  font-size: 48rpx;
  font-weight: 300;
}

.loading-state {
  padding: 80rpx 0;
  color: $text-secondary;
  text-align: center;
}

.logout {
  margin-top: 48rpx;
  border: 0;
  background: transparent;
  color: $text-secondary;
  font-size: 24rpx;
}

.logout::after {
  border: 0;
}
</style>
