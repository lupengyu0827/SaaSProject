<!-- 商家登录页：按消费者端浅色帧风格还原，语义 Token + 主题 class。 -->
<script setup lang="ts">
import { reactive, ref } from 'vue';

import { loginMerchant } from '../../api/modules/auth.api';
import { useAppTheme } from '../../composables/use-app-theme';
import { useMerchantSessionStore } from '../../stores/use-merchant-session-store';

const { themeClass } = useAppTheme();
const sessionStore = useMerchantSessionStore();
const submitting = ref(false);
const form = reactive({ email: 'owner@s0-mobile.local', password: 'S0-Mobile-Test-2026!' });

/** 提交商家账号密码登录。 */
async function handleLogin(): Promise<void> {
  if (!form.email.trim() || !form.password) {
    void uni.showToast({ title: '请输入账号和密码', icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    const session = await loginMerchant({
      email: form.email.trim(),
      password: form.password,
    });
    sessionStore.setContext({
      merchant: session.merchant,
      tenant: session.tenant,
      permissions: session.permissions,
    });
    await uni.reLaunch({ url: '/pages/workbench/index' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '登录失败，请稍后重试';
    void uni.showToast({ title: message, icon: 'none', duration: 2500 });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <view class="page" :class="themeClass">
    <view class="brand-section">
      <text class="eyebrow">MERCHANT ACCESS</text>
      <text class="title">登录店铺工作台</text>
      <text class="description">输入账号和密码，系统会自动识别所属店铺</text>
    </view>

    <view class="form-card">
      <view class="field">
        <text class="label">账号邮箱</text>
        <view class="input-shell">
          <input v-model="form.email" class="input" type="text" placeholder="name@example.com" />
        </view>
      </view>
      <view class="field">
        <text class="label">密码</text>
        <view class="input-shell">
          <input v-model="form.password" class="input" password placeholder="请输入密码" />
        </view>
      </view>
      <button class="submit" :loading="submitting" :disabled="submitting" @click="handleLogin">
        登录工作台
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '../../styles/tokens.scss';
.page {
  min-height: 100vh;
  padding: calc(env(safe-area-inset-top) + 120rpx) 32rpx 48rpx;
  color: var(--theme-text);
  background: var(--theme-bg);
}
.brand-section {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.eyebrow {
  color: var(--theme-accent);
  font-family: $font-mono;
  font-size: 20rpx;
  letter-spacing: 4rpx;
}
.title {
  color: var(--theme-text);
  font-family: $font-display;
  font-size: 48rpx;
  font-weight: 700;
}
.description {
  color: var(--theme-text-secondary);
  font-size: 26rpx;
  line-height: 1.6;
}
.form-card {
  margin-top: 64rpx;
  padding: 40rpx 32rpx;
  border-radius: $radius-card;
  background: var(--theme-surface);
  box-shadow: $shadow-luxury;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.field + .field {
  margin-top: 32rpx;
}
.label {
  color: var(--theme-text);
  font-size: 26rpx;
  font-weight: 500;
}
.input-shell {
  border: 1rpx solid var(--theme-border);
  border-radius: $radius-control;
  background: var(--theme-bg);
}
.input {
  height: 88rpx;
  padding: 0 24rpx;
  color: var(--theme-text);
  font-size: 28rpx;
}
.submit {
  margin-top: 40rpx;
  border-radius: 999rpx;
  background: var(--theme-accent);
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 80rpx;
}
.submit::after {
  border: 0;
}
.submit[disabled] {
  opacity: 0.6;
}
</style>
