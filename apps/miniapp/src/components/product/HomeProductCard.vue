<!-- 首页双列商品卡：以图片、品类、品相和价格构成紧凑的编辑式陈列。 -->
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
  lowestPrice.value ? formatCurrency(lowestPrice.value) : '价格待询',
);
const categoryText = computed(() => getAttributeText('category') ?? '私人藏品');
const conditionText = computed(() => getAttributeText('condition') ?? '已鉴定');

/** 进入藏品详情。 */
function handleOpenDetail(): void {
  void uni.navigateTo({ url: `/pages/product/detail?id=${encodeURIComponent(props.product.id)}` });
}

function getAttributeText(key: string): string | null {
  if (typeof props.product.attributes !== 'object' || props.product.attributes === null)
    return null;
  const value = (props.product.attributes as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
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
    <view v-else class="product-image product-placeholder">
      <text>L</text>
      <text>IMAGE PENDING</text>
    </view>
    <view class="product-content">
      <view class="product-meta">
        <text class="product-category">{{ categoryText }}</text>
        <text class="product-code">{{ product.code }}</text>
      </view>
      <text class="product-name">{{ product.name }}</text>
      <text class="product-condition">{{ conditionText }}</text>
      <view class="product-footer">
        <text class="product-price">{{ priceText }}</text>
        <text class="product-arrow">→</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@use '../../styles/tokens.scss' as *;
.product-card {
  overflow: hidden;
  border-radius: 6rpx;
  background: $bg-surface;
  box-shadow: 0 10rpx 28rpx rgba(68, 54, 35, 0.08);
}
.product-card--pressed {
  opacity: 0.82;
}
.product-image {
  display: block;
  width: 100%;
  height: 400rpx;
  background: #ddd6c9;
}
.product-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  color: $text-secondary;
  font-family: $font-mono;
  font-size: 16rpx;
  letter-spacing: 2rpx;
}
.product-placeholder text:first-child {
  color: $accent-primary;
  font-family: $font-display;
  font-size: 64rpx;
}
.product-content {
  padding: 20rpx 18rpx 22rpx;
}
.product-meta,
.product-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8rpx;
}
.product-category {
  color: #9b642e;
  font-size: 16rpx;
  letter-spacing: 1rpx;
  white-space: nowrap;
}
.product-code {
  color: $text-secondary;
  font-family: $font-mono;
  font-size: 14rpx;
  white-space: nowrap;
}
.product-name {
  display: -webkit-box;
  min-height: 72rpx;
  margin-top: 14rpx;
  overflow: hidden;
  color: #171b22;
  font-family: $font-display;
  font-size: 25rpx;
  font-weight: 600;
  line-height: 1.42;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.product-condition {
  display: block;
  margin-top: 8rpx;
  color: #858078;
  font-size: 17rpx;
}
.product-footer {
  margin-top: 18rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #ece6dc;
}
.product-price {
  color: #7f4b20;
  font-family: $font-mono;
  font-size: 21rpx;
  font-weight: 600;
}
.product-arrow {
  color: #8f765d;
  font-size: 22rpx;
}
</style>
