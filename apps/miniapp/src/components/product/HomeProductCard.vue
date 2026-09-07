<!-- 首页双列商品卡：以图片、品类、品相和价格构成紧凑的编辑式陈列。 -->
<script setup lang="ts">
import type { PublicProductResponse } from '@saas/contracts';
import { computed } from 'vue';

import { formatCurrency, getLowestPrice, getPrimaryImage } from '../../utils/product-view';

interface Props {
  product: PublicProductResponse;
}
const props = defineProps<Props>();
const primaryImage = computed(() => getPrimaryImage(props.product));
const lowestPrice = computed(() => getLowestPrice(props.product));
const priceText = computed(() =>
  lowestPrice.value ? formatCurrency(lowestPrice.value) : '价格待询',
);
const categoryText = computed(() => props.product.attributes.material ?? '私人藏品');
const conditionText = computed(() => conditionLabel(props.product.attributes.conditionGrade));
/** 评分文本：契约提供 rating 时展示评分，否则回退到品相标签。 */
const ratingText = computed(() => {
  const rating = props.product.rating;
  if (rating == null) return conditionText.value;
  const count = props.product.reviewCount;
  return count != null ? `${rating.toFixed(1)} (${count})` : rating.toFixed(1);
});
const starIcon = '/static/figma/home-light/star.svg';

/** 进入藏品详情。 */
function handleOpenDetail(): void {
  void uni.navigateTo({ url: `/pages/product/detail?id=${encodeURIComponent(props.product.id)}` });
}

function conditionLabel(grade: PublicProductResponse['attributes']['conditionGrade']): string {
  return { new: '全新', excellent: '近新', good: '品相良好', fair: '有使用痕迹' }[grade ?? 'good'];
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
      <text class="product-category">{{ categoryText }}</text>
      <text class="product-name">{{ product.name }}</text>
      <view class="product-condition">
        <image class="condition-star" :src="starIcon" mode="aspectFit" />
        <text>{{ ratingText }}</text>
      </view>
      <text class="product-price">{{ priceText }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
@use '../../styles/tokens.scss' as *;
.product-card {
  overflow: hidden;
  border: 1rpx solid var(--theme-border-soft);
  border-radius: 24rpx;
  background: var(--theme-surface);
}
.product-card--pressed {
  opacity: 0.82;
}
.product-image {
  display: block;
  width: 100%;
  height: 320rpx;
  background: var(--theme-border-soft);
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
  padding: 24rpx;
}
.product-category {
  display: block;
  color: var(--theme-accent);
  font-family: $font-display;
  font-size: 20rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
  white-space: nowrap;
}
.product-name {
  display: block;
  margin-top: 8rpx;
  overflow: hidden;
  color: var(--theme-text);
  font-size: 26rpx;
  font-weight: 500;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.product-condition {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 8rpx;
  color: var(--theme-text-secondary);
  font-size: 20rpx;
}
.condition-star {
  width: 20rpx;
  height: 20rpx;
}
.product-price {
  display: block;
  margin-top: 8rpx;
  color: var(--theme-text);
  font-family: $font-mono;
  font-size: 28rpx;
  font-weight: 700;
}
</style>
