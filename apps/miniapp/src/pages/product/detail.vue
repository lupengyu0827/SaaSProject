<!-- 商品详情页：展示真实商品资料、规格选择与可复制藏品编号。 -->
<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import type { PublicProductResponse, PublicProductVariantResponse } from '@saas/contracts';
import { computed, ref, shallowRef } from 'vue';
import { getProductDetail } from '../../api/modules/product.api';
import StatePanel from '../../components/common/StatePanel.vue';
import { formatCurrency, getPrimaryImage, getVariantSpecText } from '../../utils/product-view';

const productId = ref('');
const product = shallowRef<PublicProductResponse | null>(null);
const selectedVariant = shallowRef<PublicProductVariantResponse | null>(null);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);
const imageLoadFailed = ref(false);
const imageReloadKey = ref(0);
const primaryImage = computed(() => (product.value ? getPrimaryImage(product.value) : null));
const priceText = computed(() =>
  selectedVariant.value ? formatCurrency(selectedVariant.value.price) : '价格待询',
);

/** 读取当前租户商品详情。 */
async function loadProduct(): Promise<void> {
  if (!productId.value) {
    errorMessage.value = '商品编号无效，请返回藏品列表重试';
    isLoading.value = false;
    return;
  }
  isLoading.value = true;
  errorMessage.value = null;
  try {
    product.value = await getProductDetail(productId.value);
    selectedVariant.value = product.value.variants[0] ?? null;
    imageLoadFailed.value = false;
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '加载商品详情失败';
  } finally {
    isLoading.value = false;
  }
}

function handleSelectVariant(variant: PublicProductVariantResponse): void {
  selectedVariant.value = variant;
}
function handleCopyCode(): void {
  if (!product.value) return;
  uni.setClipboardData({
    data: product.value.code,
    success: () => uni.showToast({ title: '藏品编号已复制', icon: 'success' }),
  });
}
function handleRetry(): void {
  void loadProduct();
}

/** 标记商品主图加载失败，并提供显式重试入口。 */
function handleImageError(): void {
  imageLoadFailed.value = true;
}

/** 重新创建图片节点，触发微信客户端再次拉取媒体资源。 */
function handleRetryImage(): void {
  imageLoadFailed.value = false;
  imageReloadKey.value += 1;
}

onLoad((query) => {
  productId.value = typeof query?.id === 'string' ? query.id : '';
  void loadProduct();
});
</script>

<template>
  <view class="page">
    <template v-if="product">
      <image
        v-if="primaryImage && !imageLoadFailed"
        :key="imageReloadKey"
        class="hero-image"
        :src="primaryImage"
        mode="aspectFill"
        @error="handleImageError"
      />
      <view v-else class="hero-image hero-placeholder">
        <text class="placeholder-monogram">L</text>
        <text class="placeholder-caption">
          {{ imageLoadFailed ? 'IMAGE UNAVAILABLE' : 'PRIVATE OBJECT' }}
        </text>
        <button v-if="imageLoadFailed" class="image-retry" @click="handleRetryImage">
          重新加载图片
        </button>
      </view>
      <view class="detail-content">
        <view class="detail-meta">
          <text class="product-code">{{ product.code }}</text>
          <text class="product-status">在售</text>
        </view>
        <text class="product-name">{{ product.name }}</text>
        <text class="product-price">{{ priceText }}</text>
        <view v-if="product.variants.length" class="detail-section">
          <text class="section-kicker">SPECIFICATION</text>
          <text class="section-title">选择藏品规格</text>
          <scroll-view class="variant-scroll" scroll-x enable-flex>
            <view class="variant-list">
              <button
                v-for="variant in product.variants"
                :key="variant.id"
                class="variant-button"
                :class="{ 'variant-button--active': selectedVariant?.id === variant.id }"
                @click="handleSelectVariant(variant)"
              >
                <text class="variant-spec">{{ getVariantSpecText(variant) }}</text>
                <text class="variant-sku">可售 {{ variant.availableStockQty }} 件</text>
              </button>
            </view>
          </scroll-view>
        </view>
        <view v-if="product.description" class="detail-section">
          <text class="section-kicker">PROVENANCE</text>
          <text class="section-title">藏品说明</text>
          <text class="product-description">{{ product.description }}</text>
        </view>
        <view class="identity-row" @click="handleCopyCode">
          <view>
            <text class="identity-label">COLLECTION ID</text>
            <text class="identity-value">{{ product.code }}</text>
          </view>
          <text class="copy-action">复制编号</text>
        </view>
      </view>
    </template>
    <StatePanel
      v-else-if="isLoading"
      eyebrow="PREPARING"
      title="正在开启藏品档案"
      description="商品资料正在安全读取中，请稍候。"
    />
    <StatePanel
      v-else
      eyebrow="SERVICE NOTICE"
      title="暂时无法查看藏品"
      :description="errorMessage ?? '商品资料暂不可用'"
      action-label="重新加载"
      @action="handleRetry"
    />
  </view>
</template>

<style scoped lang="scss">
@use '../../styles/tokens.scss' as *;
.page {
  min-height: 100vh;
  padding-bottom: 64rpx;
}
.hero-image {
  display: block;
  width: 100%;
  height: 900rpx;
  background: $bg-dark-base;
}
.hero-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.placeholder-monogram {
  color: $accent-gold-light;
  font-family: $font-display;
  font-size: 128rpx;
}
.placeholder-caption {
  margin-top: 24rpx;
  color: $text-dark-secondary;
  font-family: $font-mono;
  font-size: 20rpx;
  letter-spacing: 5rpx;
}
.image-retry {
  margin-top: 32rpx;
  padding: 16rpx 28rpx;
  border: 1rpx solid $border-dark-subtle;
  border-radius: $radius-control;
  color: $text-dark-primary;
  background: $bg-dark-surface;
  font-size: 24rpx;
  white-space: nowrap;
}
.image-retry::after {
  border: 0;
}
.detail-content {
  padding: 40rpx 32rpx 0;
}
.detail-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.product-code,
.identity-label,
.variant-sku,
.section-kicker {
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
  margin-top: 24rpx;
  color: $text-primary;
  font-family: $font-display;
  font-size: 48rpx;
  font-weight: 600;
  line-height: 1.35;
}
.product-price {
  display: block;
  margin-top: 16rpx;
  color: $accent-primary;
  font-family: $font-mono;
  font-size: 40rpx;
  font-weight: 600;
}
.detail-section {
  margin-top: 48rpx;
  padding-top: 32rpx;
  border-top: 1rpx solid $border-subtle;
}
.section-kicker {
  display: block;
  color: $accent-primary;
}
.section-title {
  display: block;
  margin-top: 12rpx;
  color: $text-primary;
  font-family: $font-display;
  font-size: 34rpx;
  font-weight: 600;
}
.variant-scroll {
  width: 100%;
  margin-top: 24rpx;
  white-space: nowrap;
}
.variant-list {
  display: flex;
  gap: 16rpx;
}
.variant-button {
  display: flex;
  flex-direction: column;
  min-width: 240rpx;
  margin: 0;
  padding: 20rpx 24rpx;
  border: 1rpx solid $border-subtle;
  border-radius: $radius-control;
  color: $text-primary;
  background: $bg-surface;
  line-height: 1.4;
  text-align: left;
  &::after {
    border: 0;
  }
}
.variant-button--active {
  border-color: $accent-primary;
  background: $accent-champagne;
}
.variant-spec {
  font-size: 26rpx;
  font-weight: 600;
  white-space: nowrap;
}
.variant-sku {
  margin-top: 8rpx;
  white-space: nowrap;
}
.product-description {
  display: block;
  margin-top: 20rpx;
  color: $text-secondary;
  font-size: 28rpx;
  line-height: 1.8;
  white-space: pre-wrap;
}
.identity-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  margin-top: 48rpx;
  padding: 28rpx 0;
  border-top: 1rpx solid $border-subtle;
  border-bottom: 1rpx solid $border-subtle;
}
.identity-label,
.identity-value {
  display: block;
}
.identity-value {
  margin-top: 8rpx;
  color: $text-primary;
  font-family: $font-mono;
  font-size: 26rpx;
}
.copy-action {
  color: $accent-primary;
  font-size: 24rpx;
  font-weight: 600;
  white-space: nowrap;
}
</style>
