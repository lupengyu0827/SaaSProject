<!-- 小程序消费者登录页：明确触发微信身份交换并建立租户隔离会话。 -->
<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import { ref } from 'vue';

import { ensureCustomerAccessToken } from '../../api/modules/auth.api';
import { getAccessToken, getCurrentTenantId } from '../../config/runtime';

const isLoggingIn = ref(false);
const errorMessage = ref<string | null>(null);

/** 使用微信身份进入当前租户精品店。 */
async function handleWechatLogin(): Promise<void> {
  if (isLoggingIn.value) return;
  isLoggingIn.value = true;
  errorMessage.value = null;
  try {
    await ensureCustomerAccessToken();
    await uni.reLaunch({ url: '/pages/index/index' });
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '登录失败，请稍后重试';
  } finally {
    isLoggingIn.value = false;
  }
}

onLoad(() => {
  if (getAccessToken() && getCurrentTenantId()) {
    void uni.reLaunch({ url: '/pages/index/index' });
  }
});
</script>

<template>
  <view class="login-page">
    <view class="safe-area" />
    <view class="brand-lockup">
      <text class="brand-monogram">L</text>
      <text class="brand-name">L'ATELIER</text>
      <text class="brand-caption">PRIVATE JEWELLERY SALON</text>
    </view>
    <view class="welcome-panel">
      <text class="welcome-kicker">MEMBERS' ENTRANCE</text>
      <text class="welcome-title">步入私享珠宝殿堂</text>
      <text class="welcome-description">
        登录后即可浏览当前精品店的实时在售藏品。您的身份与访问数据仅在当前租户内使用。
      </text>
      <button
        class="login-button"
        :loading="isLoggingIn"
        :disabled="isLoggingIn"
        @click="handleWechatLogin"
      >
        {{ isLoggingIn ? '正在验证身份…' : '微信快捷进入' }}
      </button>
      <text v-if="errorMessage" class="error-message">{{ errorMessage }}</text>
      <view class="trust-row">
        <view class="trust-item">
          <text class="trust-mark">01</text>
          <text>租户隔离</text>
        </view>
        <view class="trust-item">
          <text class="trust-mark">02</text>
          <text>安全会话</text>
        </view>
        <view class="trust-item">
          <text class="trust-mark">03</text>
          <text>实时藏品</text>
        </view>
      </view>
    </view>
    <text class="privacy-note">继续即表示您授权本小程序完成微信身份验证</text>
  </view>
</template>

<style scoped lang="scss">
@use '../../styles/tokens.scss' as *;
.login-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 0 48rpx calc(40rpx + env(safe-area-inset-bottom));
  color: $text-dark-primary;
  background: $bg-dark-base;
}
.safe-area {
  height: calc(88rpx + env(safe-area-inset-top));
}
.brand-lockup {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.brand-monogram {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 112rpx;
  height: 112rpx;
  border: 1rpx solid $border-dark-subtle;
  border-radius: 50%;
  color: $accent-gold-light;
  font-family: $font-display;
  font-size: 56rpx;
}
.brand-name {
  margin-top: 24rpx;
  color: $accent-gold-light;
  font-family: $font-display;
  font-size: 28rpx;
  letter-spacing: 10rpx;
}
.brand-caption,
.welcome-kicker {
  margin-top: 12rpx;
  color: $text-dark-secondary;
  font-family: $font-mono;
  font-size: 18rpx;
  letter-spacing: 3rpx;
}
.welcome-panel {
  margin-top: 80rpx;
  padding: 48rpx 40rpx;
  border: 1rpx solid $border-dark-subtle;
  border-radius: $radius-card;
  background: $bg-dark-surface;
  box-shadow: $shadow-dark-luxury;
}
.welcome-kicker {
  display: block;
  margin-top: 0;
  color: $accent-gold-light;
}
.welcome-title {
  display: block;
  margin-top: 20rpx;
  font-family: $font-display;
  font-size: 48rpx;
  font-weight: 600;
  line-height: 1.35;
}
.welcome-description {
  display: block;
  margin-top: 24rpx;
  color: $text-dark-secondary;
  font-size: 26rpx;
  line-height: 1.8;
}
.login-button {
  width: 100%;
  margin-top: 48rpx;
  padding: 24rpx 48rpx;
  border: 0;
  border-radius: $radius-control;
  color: $bg-dark-base;
  background: $accent-gold-light;
  font-size: 28rpx;
  font-weight: 600;
  white-space: nowrap;
  &::after {
    border: 0;
  }
}
.login-button[disabled] {
  opacity: 0.68;
}
.error-message {
  display: block;
  margin-top: 20rpx;
  color: #fb7185;
  font-size: 24rpx;
  line-height: 1.6;
  text-align: center;
}
.trust-row {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 48rpx;
  padding-top: 32rpx;
  border-top: 1rpx solid $border-dark-subtle;
}
.trust-item {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  color: $text-dark-secondary;
  font-size: 20rpx;
  white-space: nowrap;
}
.trust-mark {
  color: $accent-gold-light;
  font-family: $font-mono;
}
.privacy-note {
  margin-top: auto;
  padding-top: 48rpx;
  color: $text-dark-secondary;
  font-size: 20rpx;
  line-height: 1.6;
  text-align: center;
}
</style>
