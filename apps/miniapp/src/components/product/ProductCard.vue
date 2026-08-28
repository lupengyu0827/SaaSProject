<!-- C 端商品陈列卡：展示真实商品契约数据并跳转详情。 -->
<script setup lang="ts">
import type { ProductResponse } from '@saas/contracts';
import { computed } from 'vue';
import { formatCurrency, getLowestPrice, getPrimaryImage } from '../../utils/product-view';

interface Props {
  product: ProductResponse;
}
const props = defineProps<Props>();
const primaryImage = computed(() => getPrimaryImage(props.product));
const lowestPrice = computed(() => getLowestPrice(props.product));
const priceText = computed(() =>
  lowestPrice.value === null ? '价格待询' : formatCurrency(lowestPrice.value),
);

/** 进入商品详情页。 */
function handleOpenDetail(): void {
  void uni.navigateTo({ url: `/pages/product/detail?id=${encodeURIComponent(props.product.id)}` });
}
</script>

<template>
  <view class="product-card" hover-class="product-card--pressed" @click="handleOpenDetail">
    <image
      v-if="primaryImage"
      class="product-image"
      :src="primaryImage"
      mode="aspectFill"
      lazy-load
    />
    <view v-else class="product-image product-placeholder" aria-label="商品暂未上传图片">
      <text class="placeholder-monogram">L</text>
      <text class="placeholder-caption">IMAGE PENDING</text>
    </view>
    <view class="product-content">
      <view class="product-meta">
        <text class="product-code">{{ product.code }}</text>
        <text class="product-status">在售</text>
      </view>
      <text class="product-name">{{ product.name }}</text>
      <text v-if="product.description" class="product-description">{{ product.description }}</text>
      <view class="product-footer">
        <text class="product-price">{{ priceText }}</text>
        <text class="product-cta">查看藏品 →</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@use '../../styles/tokens.scss' as *;
.product-card {
  overflow: hidden;
  border: 1rpx solid $border-subtle;
  border-radius: $radius-card;
  background: $bg-surface;
  box-shadow: $shadow-luxury;
  transition: transform 160ms ease;
}
.product-card--pressed {
  transform: scale(0.99);
}
.product-image {
  display: block;
  width: 100%;
  height: 760rpx;
  background: $bg-muted;
}
.product-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.placeholder-monogram {
  color: $accent-primary;
  font-family: $font-display;
  font-size: 112rpx;
  line-height: 1;
}
.placeholder-caption {
  margin-top: 24rpx;
  color: $text-secondary;
  font-family: $font-mono;
  font-size: 20rpx;
  letter-spacing: 4rpx;
}
.product-content {
  padding: 32rpx;
}
.product-meta,
.product-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.product-code {
  color: $text-secondary;
  font-family: $font-mono;
  font-size: 20rpx;
  letter-spacing: 2rpx;
}
.product-status {
  padding: 8rpx 16rpx;
  border: 1rpx solid $success-border;
  border-radius: 999rpx;
  color: $success-text;
  background: $success-bg;
  font-size: 20rpx;
  white-space: nowrap;
}
.product-name {
  display: block;
  margin-top: 16rpx;
  color: $text-primary;
  font-family: $font-display;
  font-size: 36rpx;
  font-weight: 600;
  line-height: 1.4;
}
.product-description {
  display: -webkit-box;
  margin-top: 16rpx;
  overflow: hidden;
  color: $text-secondary;
  font-size: 26rpx;
  line-height: 1.7;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.product-footer {
  margin-top: 32rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid $border-subtle;
}
.product-price {
  color: $accent-primary;
  font-family: $font-mono;
  font-size: 32rpx;
  font-weight: 600;
}
.product-cta {
  color: $text-primary;
  font-size: 24rpx;
  font-weight: 600;
  white-space: nowrap;
}
</style>
