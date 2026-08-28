<!-- 通用页面状态面板：承载加载、空数据和错误反馈。 -->
<script setup lang="ts">
interface Props {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel?: string;
}
interface Emits {
  (event: 'action'): void;
}
defineProps<Props>();
const emit = defineEmits<Emits>();

/** 触发状态面板主操作。 */
function handleAction(): void {
  emit('action');
}
</script>

<template>
  <view class="state-panel">
    <view class="state-mark" aria-hidden="true">L</view>
    <text class="state-eyebrow">{{ eyebrow }}</text>
    <text class="state-title">{{ title }}</text>
    <text class="state-description">{{ description }}</text>
    <button v-if="actionLabel" class="state-action" @click="handleAction">{{ actionLabel }}</button>
  </view>
</template>

<style scoped lang="scss">
@use '../../styles/tokens.scss' as *;
.state-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64rpx 32rpx;
  text-align: center;
}
.state-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88rpx;
  height: 88rpx;
  border: 1rpx solid $border-gold-subtle;
  border-radius: 50%;
  color: $accent-primary;
  font-family: $font-display;
  font-size: 44rpx;
}
.state-eyebrow {
  margin-top: 32rpx;
  color: $accent-primary;
  font-family: $font-mono;
  font-size: 20rpx;
  letter-spacing: 3rpx;
}
.state-title {
  margin-top: 16rpx;
  color: $text-primary;
  font-family: $font-display;
  font-size: 40rpx;
  font-weight: 600;
}
.state-description {
  max-width: 560rpx;
  margin-top: 16rpx;
  color: $text-secondary;
  font-size: 26rpx;
  line-height: 1.7;
}
.state-action {
  min-width: 216rpx;
  margin-top: 32rpx;
  padding: 20rpx 40rpx;
  border: 0;
  border-radius: $radius-control;
  color: $text-on-accent;
  background: $accent-primary;
  font-size: 26rpx;
  line-height: 1.4;
  white-space: nowrap;
  &::after {
    border: 0;
  }
}
</style>
