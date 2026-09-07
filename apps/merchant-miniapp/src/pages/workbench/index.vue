<!-- 商家经营工作台：按竞品奢当家首页信息架构重构，视觉对齐消费者端轻奢风（米白底 / 暖金 / 衬线标题 / 卡片化）。 -->
<script setup lang="ts">
import { onPullDownRefresh } from '@dcloudio/uni-app';
import { onMounted, ref } from 'vue';

import { getMerchantSession, logoutMerchant } from '../../api/modules/auth.api';
import { getMerchantAccessToken } from '../../config/runtime';
import { useAppTheme } from '../../composables/use-app-theme';
import { useMerchantSessionStore } from '../../stores/use-merchant-session-store';

const { themeClass } = useAppTheme();
const sessionStore = useMerchantSessionStore();
const loading = ref(true);
const statusBarHeight = uni.getSystemInfoSync().statusBarHeight ?? 20;

const merchantName = ref('店铺成员');
const storeName = ref('当前店铺');
const unreadCount = ref(3);

interface ModuleItem {
  label: string;
  icon: string;
  badge?: string;
  route?: string;
}

/** 销售模块。 */
const salesItems: ModuleItem[] = [
  { label: '在售商品', icon: '/static/icons/product.png', route: '/pages/products/active' },
  { label: '锁单中', icon: '/static/icons/lock.png', badge: '待处理' },
  { label: '寄卖传送', icon: '/static/icons/consign.png' },
  { label: '订单管理', icon: '/static/icons/order-list.png' },
];

/** 仓库模块。 */
const warehouseItems: ModuleItem[] = [
  { label: '仓库', icon: '/static/icons/warehouse.png' },
  { label: '质押商品', icon: '/static/icons/pledge.png' },
  { label: '商品盘点', icon: '/static/icons/inventory.png' },
  { label: '临时仓', icon: '/static/icons/temp.png' },
  { label: '库龄预警', icon: '/static/icons/alarm.png' },
  { label: '采购清单', icon: '/static/icons/purchase.png' },
];

/** 店铺模块。 */
const storeItems: ModuleItem[] = [
  { label: '曝光指数', icon: '/static/icons/exposure.png' },
  { label: '员工权限', icon: '/static/icons/staff.png' },
  { label: '其他记账', icon: '/static/icons/bookkeeping.png' },
];

/** 未建设功能统一占位提示。 */
function handleTodo(): void {
  uni.showToast({ title: '功能建设中，敬请期待', icon: 'none' });
}

/** 顶部动作：扫码 / 客服 / 消息。 */
function handleScan(): void {
  uni.showToast({ title: '扫一扫功能建设中', icon: 'none' });
}
function handleService(): void {
  uni.showToast({ title: '客服服务建设中', icon: 'none' });
}
function handleMessage(): void {
  uni.showToast({ title: `你有 ${unreadCount.value} 条未读消息`, icon: 'none' });
}

/** 搜索。 */
function handleSearch(): void {
  handleTodo();
}

/** 切换店铺。 */
function handleSwitchStore(): void {
  handleTodo();
}

/** 模块入口跳转：已有页面真实跳转，其余占位提示。 */
function handleModule(item: ModuleItem): void {
  if (item.route) {
    void uni.navigateTo({ url: item.route });
    return;
  }
  handleTodo();
}

/** 退出商家工作台。 */
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
    merchantName.value = sessionStore.currentMerchant?.displayName ?? '店铺成员';
    storeName.value = sessionStore.currentTenant?.name ?? '当前店铺';
  } catch {
    sessionStore.clear();
    await uni.reLaunch({ url: '/pages/auth/login' });
  } finally {
    loading.value = false;
  }
});

onPullDownRefresh(async () => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  uni.stopPullDownRefresh();
});
</script>

<template>
  <view class="page" :class="themeClass">
    <!-- 自定义导航：店铺 + 扫码 / 客服 / 消息 -->
    <view class="nav" :style="{ paddingTop: `${statusBarHeight}px` }">
      <view class="nav-inner">
        <view class="store-switch" @click="handleSwitchStore">
          <text class="store-name">{{ loading ? '加载中…' : storeName }}</text>
          <text class="store-arrow">⌄</text>
        </view>
        <!-- 扫一扫 / 客服 / 消息 暂未开放，先注释 -->
        <view class="nav-actions">
          <!-- <view class="nav-action" @click="handleScan">
            <image class="nav-icon" src="/static/icons/scan.svg" mode="aspectFit" />
          </view>
          <view class="nav-action" @click="handleService">
            <image class="nav-icon" src="/static/icons/service.svg" mode="aspectFit" />
          </view>
          <view class="nav-action" @click="handleMessage">
            <image class="nav-icon" src="/static/icons/message.svg" mode="aspectFit" />
            <view v-if="unreadCount" class="nav-dot" />
          </view> -->
        </view>
      </view>
      <!-- 搜索 -->
      <view class="search-shell" @click="handleSearch">
        <image class="search-icon" src="/static/icons/search.png" mode="aspectFit" />
        <text class="search-placeholder">搜索商品名称、描述、备注、独立编码</text>
      </view>
    </view>

    <view class="body">
      <!-- 销售模块 -->
      <view class="section">
        <view class="section-head">
          <text class="section-mark" />
          <text class="section-title">销售</text>
        </view>
        <view class="card grid grid-4">
          <view
            v-for="item in salesItems"
            :key="item.label"
            class="grid-item"
            @click="handleModule(item)"
          >
            <view class="icon-wrap">
              <image class="icon-4" :src="item.icon" mode="aspectFit" />
              <view class="icon-shadow" />
              <text v-if="item.badge" class="icon-badge">{{ item.badge }}</text>
            </view>
            <text class="grid-label">{{ item.label }}</text>
          </view>
        </view>
      </view>

      <!-- 仓库模块 -->
      <view class="section">
        <view class="section-head">
          <text class="section-mark" />
          <text class="section-title">仓库</text>
        </view>
        <view class="card grid grid-3">
          <view
            v-for="item in warehouseItems"
            :key="item.label"
            class="grid-item"
            @click="handleTodo"
          >
            <view class="icon-wrap">
              <image class="icon-3" :src="item.icon" mode="aspectFit" />
              <view class="icon-shadow" />
            </view>
            <text class="grid-label">{{ item.label }}</text>
          </view>
        </view>
      </view>

      <!-- 店铺模块 -->
      <view class="section">
        <view class="section-head">
          <text class="section-mark" />
          <text class="section-title">店铺</text>
        </view>
        <view class="card grid grid-3">
          <view
            v-for="item in storeItems"
            :key="item.label"
            class="grid-item"
            @click="handleTodo"
          >
            <view class="icon-wrap">
              <image class="icon-3" :src="item.icon" mode="aspectFit" />
              <view class="icon-shadow" />
            </view>
            <text class="grid-label">{{ item.label }}</text>
          </view>
        </view>
      </view>

      <view class="logout-row" @click="handleLogout">
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

/* ===== 顶部导航 ===== */
.nav {
  background: var(--theme-bg);
  padding-bottom: 16rpx;
}
.nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 32rpx;
}
.store-switch {
  display: flex;
  align-items: center;
  gap: 8rpx;
  max-width: 380rpx;
}
.store-name {
  overflow: hidden;
  color: var(--theme-text);
  font-family: $font-display;
  font-size: 32rpx;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.store-arrow {
  color: var(--theme-accent);
  font-size: 28rpx;
}
.nav-actions {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.nav-action {
  position: relative;
  display: flex;
  width: 72rpx;
  height: 72rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--theme-surface);
  box-shadow: $shadow-luxury;
}
.nav-icon {
  width: 36rpx;
  height: 36rpx;
}
.nav-dot {
  position: absolute;
  top: 14rpx;
  right: 14rpx;
  width: 14rpx;
  height: 14rpx;
  border: 2rpx solid var(--theme-bg);
  border-radius: 50%;
  background: var(--theme-danger);
}
.search-shell {
  display: flex;
  align-items: center;
  gap: 16rpx;
  height: 76rpx;
  margin: 8rpx 32rpx 0;
  padding: 0 28rpx;
  border-radius: 999rpx;
  background: var(--theme-surface);
  box-shadow: $shadow-luxury;
}
.search-icon {
  width: 32rpx;
  height: 32rpx;
  flex-shrink: 0;
}
.search-placeholder {
  color: var(--theme-text-muted);
  font-size: 26rpx;
}

/* ===== 内容 ===== */
.body {
  padding: 8rpx 32rpx calc(48rpx + env(safe-area-inset-bottom));
}
.section {
  margin-top: 32rpx;
}
.section-head {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
}
.section-mark {
  width: 8rpx;
  height: 30rpx;
  border-radius: 999rpx;
  background: var(--theme-accent);
}
.section-title {
  color: var(--theme-text);
  font-family: $font-display;
  font-size: 34rpx;
  font-weight: 700;
}

/* ===== 卡片与宫格 ===== */
.card {
  padding: 28rpx 16rpx 12rpx;
  border-radius: $radius-card;
  background: var(--theme-surface);
  box-shadow: $shadow-luxury;
}
.grid {
  display: flex;
  flex-wrap: wrap;
}
.grid-4 .grid-item {
  width: 25%;
}
.grid-3 .grid-item {
  width: 33.3333%;
}
.grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 24rpx;
}
.icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-bottom: 10rpx;
}
.icon-4 {
  position: relative;
  z-index: 1;
  width: 48rpx;
  height: 48rpx;
}
.icon-3 {
  position: relative;
  z-index: 1;
  width: 56rpx;
  height: 56rpx;
}
.icon-shadow {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 66%;
  height: 12rpx;
  border-radius: 50%;
  background: rgba(28, 25, 23, 0.1);
  filter: blur(4rpx);
}
.icon-badge {
  position: absolute;
  top: -10rpx;
  right: -22rpx;
  z-index: 2;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  color: var(--theme-surface);
  background: var(--theme-accent);
  font-size: 18rpx;
  white-space: nowrap;
}
.grid-label {
  color: var(--theme-text-secondary);
  font-size: 24rpx;
}

/* ===== 退出 ===== */
.logout-row {
  padding: 40rpx 0 8rpx;
  text-align: center;
}
.logout-text {
  color: var(--theme-text-muted);
  font-size: 24rpx;
}
</style>
