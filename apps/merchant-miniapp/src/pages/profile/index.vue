<!-- 我的：店铺身份、套餐、资产管理、设置与服务（骨架页）。 -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { getMerchantSession, logoutMerchant } from '../../api/modules/auth.api';
import { getMerchantAccessToken } from '../../config/runtime';
import { useAppTheme } from '../../composables/use-app-theme';
import { useMerchantSessionStore } from '../../stores/use-merchant-session-store';

const { themeClass } = useAppTheme();
const sessionStore = useMerchantSessionStore();
const statusBarHeight = uni.getSystemInfoSync().statusBarHeight ?? 20;

const storeName = ref('当前店铺');
const merchantName = computed(() => sessionStore.currentMerchant?.displayName ?? '店铺成员');

interface MenuItem {
  label: string;
  route?: string;
}
const menuGroups: { title: string; items: MenuItem[] }[] = [
  {
    title: '经营',
    items: [
      { label: '商品管理', route: '/pages/products/index' },
      { label: '商品图片上传', route: '/pages/media/upload' },
    ],
  },
  {
    title: '账户',
    items: [{ label: '套餐与配额' }, { label: '店铺设置' }, { label: '关于与帮助' }],
  },
];

function handleTodo(): void {
  uni.showToast({ title: '功能建设中，敬请期待', icon: 'none' });
}

function handleMenu(item: MenuItem): void {
  if (item.route) {
    void uni.navigateTo({ url: item.route });
    return;
  }
  handleTodo();
}

async function handleLogout(): Promise<void> {
  await logoutMerchant();
  sessionStore.clear();
  await uni.reLaunch({ url: '/pages/auth/login' });
}

onMounted(async () => {
  if (!getMerchantAccessToken()) {
    await uni.reLaunch({ url: '/pages/auth/login' });
    return;
  }
  try {
    const session = await getMerchantSession();
    sessionStore.setContext(session);
    storeName.value = sessionStore.currentTenant?.name ?? '当前店铺';
  } catch {
    sessionStore.clear();
    await uni.reLaunch({ url: '/pages/auth/login' });
  }
});
</script>

<template>
  <view class="page" :class="themeClass">
    <view class="nav" :style="{ paddingTop: `${statusBarHeight}px` }">
      <text class="nav-title">我的</text>
    </view>
    <view class="body">
      <!-- 店铺身份卡 -->
      <view class="identity-card">
        <view class="identity-avatar">
          <text class="avatar-text">{{ storeName.slice(0, 1) }}</text>
        </view>
        <view class="identity-copy">
          <text class="identity-store">{{ storeName }}</text>
          <text class="identity-role">{{ merchantName }} · 已认证</text>
        </view>
        <text class="identity-arrow">›</text>
      </view>

      <!-- 功能分组 -->
      <view v-for="group in menuGroups" :key="group.title" class="menu-group">
        <text class="group-title">{{ group.title }}</text>
        <view class="menu-card">
          <view
            v-for="item in group.items"
            :key="item.label"
            class="menu-item"
            @click="handleMenu(item)"
          >
            <text class="menu-label">{{ item.label }}</text>
            <text class="menu-arrow">›</text>
          </view>
        </view>
      </view>

      <view class="logout-btn" @click="handleLogout">
        <text class="logout-text">退出当前账号</text>
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
.identity-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 32rpx;
  border-radius: $radius-card;
  background: var(--theme-surface);
  box-shadow: $shadow-luxury;
}
.identity-avatar {
  display: flex;
  width: 96rpx;
  height: 96rpx;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--theme-accent-soft);
}
.avatar-text {
  color: var(--theme-accent);
  font-family: $font-display;
  font-size: 40rpx;
  font-weight: 700;
}
.identity-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}
.identity-store {
  overflow: hidden;
  color: var(--theme-text);
  font-family: $font-display;
  font-size: 32rpx;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.identity-role {
  color: var(--theme-accent);
  font-size: 22rpx;
}
.identity-arrow {
  color: var(--theme-text-muted);
  font-size: 40rpx;
  font-weight: 300;
}
.menu-group {
  margin-top: 32rpx;
}
.group-title {
  display: block;
  margin-bottom: 16rpx;
  color: var(--theme-text-muted);
  font-size: 22rpx;
  letter-spacing: 2rpx;
}
.menu-card {
  overflow: hidden;
  border-radius: $radius-card;
  background: var(--theme-surface);
  box-shadow: $shadow-luxury;
}
.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 32rpx;
  border-bottom: 1rpx solid var(--theme-border-soft);
}
.menu-item:last-child {
  border-bottom: 0;
}
.menu-label {
  color: var(--theme-text);
  font-size: 28rpx;
  font-weight: 500;
}
.menu-arrow {
  color: var(--theme-text-muted);
  font-size: 36rpx;
  font-weight: 300;
}
.logout-btn {
  margin-top: 48rpx;
  padding: 28rpx 0;
  border-radius: $radius-card;
  background: var(--theme-surface);
  box-shadow: $shadow-luxury;
  text-align: center;
}
.logout-text {
  color: var(--theme-danger);
  font-size: 28rpx;
  font-weight: 500;
}
</style>
