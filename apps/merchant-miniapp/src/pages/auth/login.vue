<script setup lang="ts">
import { reactive, ref } from 'vue';

import { loginMerchant } from '../../api/modules/auth.api';
import { useMerchantSessionStore } from '../../stores/use-merchant-session-store';

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
  <view class="page-shell">
    <view class="heading">
      <text class="eyebrow">MERCHANT ACCESS</text>
      <text class="title">登录店铺工作台</text>
      <text class="description">输入账号和密码，系统会自动识别所属店铺</text>
    </view>

    <view class="form-panel">
      <view class="field">
        <text class="label">账号邮箱</text>
        <input v-model="form.email" class="input" type="text" placeholder="name@example.com" />
      </view>
      <view class="field">
        <text class="label">密码</text>
        <input v-model="form.password" class="input" password placeholder="请输入密码" />
      </view>
      <button class="submit" :loading="submitting" :disabled="submitting" @click="handleLogin">
        登录工作台
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
@use '../../styles/tokens.scss' as *;

.page-shell {
  min-height: 100vh;
  padding: 120rpx 40rpx 48rpx;
  background: $bg-base;
}

.heading,
.form-panel,
.field {
  display: flex;
  flex-direction: column;
}

.heading {
  gap: 16rpx;
}

.eyebrow {
  color: $accent-gold;
  font-size: 20rpx;
  letter-spacing: 4rpx;
}

.title {
  color: $text-primary;
  font-size: 48rpx;
  font-weight: 600;
}

.description {
  color: $text-secondary;
  font-size: 28rpx;
  line-height: 1.6;
}

.form-panel {
  gap: 32rpx;
  margin-top: 64rpx;
}

.field {
  gap: 12rpx;
}

.label {
  color: $text-primary;
  font-size: 26rpx;
  font-weight: 500;
}

.input {
  height: 88rpx;
  padding: 0 24rpx;
  border: 2rpx solid $border-subtle;
  border-radius: 16rpx;
  background: $bg-surface;
  color: $text-primary;
  font-size: 28rpx;
}

.submit {
  margin-top: 16rpx;
  border-radius: 16rpx;
  background: $accent-gold;
  color: $bg-surface;
  font-size: 30rpx;
  font-weight: 600;
}

.submit::after {
  border: 0;
}
</style>
