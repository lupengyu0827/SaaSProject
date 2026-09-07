<!-- 商品详情页：按 Figma product-detail 浅色帧还原，评分/划线价在契约字段补齐前做优雅降级。 -->
<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import type { PublicProductResponse, PublicProductVariantResponse } from '@saas/contracts';
import { computed, ref, shallowRef } from 'vue';
import { getProductDetail } from '../../api/modules/product.api';
import StatePanel from '../../components/common/StatePanel.vue';
import { useAppTheme } from '../../composables/use-app-theme';
import { useSafeArea } from '../../composables/use-safe-area';
import {
  formatCurrency,
  getPrimaryImage,
  getVariantSpecText,
} from '../../utils/product-view';

const { themeClass } = useAppTheme();
const { statusBarHeight, safeAreaBottom } = useSafeArea();

const tabs: Array<{ key: 'detail' | 'reviews' | 'aftercare'; label: string }> = [
  { key: 'detail', label: '商品详情' },
  { key: 'reviews', label: '用户评价' },
  { key: 'aftercare', label: '售后保障' },
];

const productId = ref('');
const product = shallowRef<PublicProductResponse | null>(null);
const selectedVariant = shallowRef<PublicProductVariantResponse | null>(null);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);
const imageLoadFailed = ref(false);
const imageReloadKey = ref(0);
const isFavorite = ref(false);
const activeTab = ref<'detail' | 'reviews' | 'aftercare'>('detail');

const primaryImage = computed(() => (product.value ? getPrimaryImage(product.value) : null));

/** 现价：优先取选中规格，回退到最低价。 */
const priceText = computed(() => {
  if (selectedVariant.value) return formatCurrency(selectedVariant.value.price);
  return product.value ? formatCurrency(product.value.minimumPrice) : '价格待询';
});

/** 划线价：选中规格提供了 originalPrice 才展示。 */
const originalPriceText = computed(() => {
  const original = selectedVariant.value?.originalPrice;
  return original ? formatCurrency(original) : null;
});

/** 评分：契约字段补齐前降级隐藏。 */
const ratingText = computed(() => {
  const rating = product.value?.rating;
  const count = product.value?.reviewCount;
  if (rating == null || count == null) return null;
  return `${rating.toFixed(1)} (${count} 评价)`;
});

/** 系列名：契约无 collection 字段，降级用 material 或品牌名占位。 */
const collectionLabel = computed(() => {
  const attributes = product.value?.attributes;
  return attributes?.material ?? 'PRIVATE COLLECTION';
});

/** 描述：Figma 为英文文案，契约 description 为中文，直接展示描述。 */
const descriptionText = computed(() => product.value?.description ?? '');

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

function handleBack(): void {
  void uni.navigateBack({ delta: 1 });
}

function handleToggleFavorite(): void {
  isFavorite.value = !isFavorite.value;
}

function handleShare(): void {
  uni.showToast({ title: '分享功能待接入', icon: 'none' });
}

function handleAdvisor(): void {
  uni.showToast({ title: '顾问功能待接入', icon: 'none' });
}

function handleAddToCart(): void {
  uni.showToast({ title: '已加入购物车（演示）', icon: 'none' });
}

function handleBuyNow(): void {
  uni.showToast({ title: '立即购买（演示）', icon: 'none' });
}

function handleRetry(): void {
  void loadProduct();
}

function handleImageError(): void {
  imageLoadFailed.value = true;
}

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
  <view class="page" :class="themeClass">
    <template v-if="product">
      <view class="status-bar" :style="{ height: `${statusBarHeight}px` }" />
      <!-- 顶部导航 -->
      <view class="detail-header">
        <view class="header-icon" @click="handleBack">
          <image class="icon" src="/static/figma/detail/arrow-left.svg" mode="aspectFit" />
        </view>
        <text class="header-title">{{ collectionLabel }}</text>
        <view class="header-actions">
          <view class="header-icon" @click="handleShare">
            <image class="icon" src="/static/figma/detail/share.svg" mode="aspectFit" />
          </view>
          <view class="header-icon" @click="handleToggleFavorite">
            <image
              class="icon"
              :src="isFavorite ? '/static/figma/detail/heart.svg' : '/static/figma/detail/heart.svg'"
              :class="{ 'icon--active': isFavorite }"
              mode="aspectFit"
            />
          </view>
        </view>
      </view>

      <scroll-view class="scroll-content" scroll-y>
        <!-- 主图 -->
        <view class="carousel-section">
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
        </view>

        <!-- 商品信息卡 -->
        <view class="essential-card">
          <view class="rating-row">
            <view v-if="ratingText" class="rating">
              <image class="star-icon" src="/static/figma/detail/star.svg" mode="aspectFit" />
              <text class="rating-value">{{ ratingText }}</text>
            </view>
            <view class="code" @click="handleCopyCode">
              <text class="code-text">{{ product.code }}</text>
              <text class="code-copy">复制</text>
            </view>
          </view>
          <view class="price-row">
            <text class="price-current">{{ priceText }}</text>
            <text v-if="originalPriceText" class="price-original">{{ originalPriceText }}</text>
          </view>
          <text class="series">{{ collectionLabel }}</text>
          <text class="product-name">{{ product.name }}</text>
          <text class="product-desc">{{ descriptionText }}</text>
        </view>

        <!-- 规格选择卡 -->
        <view class="specs-card">
          <view class="spec-row">
            <text class="spec-label">材质选择</text>
            <view class="spec-options">
              <button
                v-for="variant in product.variants"
                :key="variant.id"
                class="spec-chip"
                :class="{ 'spec-chip--active': selectedVariant?.id === variant.id }"
                @click="handleSelectVariant(variant)"
              >
                {{ getVariantSpecText(variant) }}
              </button>
            </view>
          </view>
          <view class="spec-row">
            <text class="spec-label">链条长度</text>
            <text class="spec-value">45cm (3档可调节)</text>
          </view>
        </view>

        <!-- Tab 详情 -->
        <view class="tabs-card">
          <view class="tabs-header">
            <text
              v-for="tab in tabs"
              :key="tab.key"
              class="tab-item"
              :class="{ 'tab-item--active': activeTab === tab.key }"
              @click="activeTab = tab.key"
            >
              {{ tab.label }}
            </text>
          </view>
          <view class="tab-content">
            <text v-if="activeTab === 'detail'" class="tab-body">{{ descriptionText }}</text>
            <text v-else-if="activeTab === 'reviews'" class="tab-body">暂无用户评价</text>
            <text v-else class="tab-body">支持 7 天无理由退换，附鉴定证书与专属礼盒配送。</text>
          </view>
        </view>

        <!-- 底部留白 -->
        <view class="bottom-spacer" />
      </scroll-view>

      <!-- 购买栏 -->
      <view class="purchase-bar">
        <view class="advisor" @click="handleAdvisor">
          <image class="icon" src="/static/figma/detail/message-circle.svg" mode="aspectFit" />
          <text class="advisor-label">顾问</text>
        </view>
        <view class="buttons">
          <button class="btn btn--outline" @click="handleAddToCart">加入购物车</button>
          <button class="btn btn--solid" @click="handleBuyNow">立即购买</button>
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
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  color: var(--theme-text);
  background: var(--theme-bg);
}
.status-bar {
  flex-shrink: 0;
  width: 100%;
  background: var(--theme-bg);
}
.detail-header {
  display: flex;
  height: 88rpx;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 0 32rpx;
  background: var(--theme-bg);
}
.header-icon {
  display: flex;
  width: 64rpx;
  height: 64rpx;
  align-items: center;
  justify-content: center;
}
.icon {
  width: 40rpx;
  height: 40rpx;
}
.icon--active {
  opacity: 1;
}
.header-title {
  flex: 1;
  padding: 0 24rpx;
  color: var(--theme-text);
  font-family: $font-display;
  font-size: 26rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  text-align: center;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.scroll-content {
  flex: 1;
  min-height: 0;
}
.carousel-section {
  padding: 16rpx 32rpx 0;
}
.hero-image {
  display: block;
  width: 100%;
  height: 600rpx;
  border-radius: 24rpx;
  background: var(--theme-border-soft);
}
.hero-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.placeholder-monogram {
  color: var(--theme-accent);
  font-family: $font-display;
  font-size: 128rpx;
}
.placeholder-caption {
  margin-top: 24rpx;
  color: var(--theme-text-muted);
  font-family: $font-mono;
  font-size: 20rpx;
  letter-spacing: 5rpx;
}
.image-retry {
  margin-top: 32rpx;
  padding: 16rpx 28rpx;
  border: 1rpx solid var(--theme-border);
  border-radius: 999rpx;
  color: var(--theme-text);
  background: var(--theme-surface);
  font-size: 24rpx;
  white-space: nowrap;
}
.image-retry::after {
  border: 0;
}
.essential-card,
.specs-card,
.tabs-card {
  margin: 32rpx 32rpx 0;
  padding: 32rpx;
  border-radius: 24rpx;
  background: var(--theme-surface);
}
.rating-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.rating {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.star-icon {
  width: 24rpx;
  height: 24rpx;
}
.rating-value {
  color: var(--theme-text);
  font-size: 24rpx;
  font-weight: 600;
}
.code {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.code-text {
  color: var(--theme-text-muted);
  font-family: $font-mono;
  font-size: 22rpx;
}
.code-copy {
  color: var(--theme-accent);
  font-size: 22rpx;
}
.price-row {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  margin-top: 24rpx;
}
.price-current {
  color: var(--theme-accent);
  font-family: $font-mono;
  font-size: 48rpx;
  font-weight: 700;
}
.price-original {
  color: var(--theme-text-muted);
  font-family: $font-mono;
  font-size: 26rpx;
  text-decoration: line-through;
}
.series {
  display: block;
  margin-top: 24rpx;
  color: var(--theme-accent);
  font-family: $font-display;
  font-size: 24rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}
.product-name {
  display: block;
  margin-top: 12rpx;
  color: var(--theme-text);
  font-family: $font-display;
  font-size: 34rpx;
  font-weight: 700;
  line-height: 1.4;
}
.product-desc {
  display: block;
  margin-top: 16rpx;
  color: var(--theme-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}
.specs-card {
  padding: 28rpx 32rpx;
}
.spec-row {
  display: flex;
  align-items: flex-start;
  gap: 24rpx;
  padding: 16rpx 0;
}
.spec-label {
  width: 128rpx;
  flex-shrink: 0;
  color: var(--theme-text);
  font-size: 26rpx;
  font-weight: 600;
}
.spec-options {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 16rpx;
}
.spec-chip {
  margin: 0;
  padding: 12rpx 24rpx;
  border: 1rpx solid var(--theme-border);
  border-radius: 999rpx;
  color: var(--theme-text-secondary);
  background: var(--theme-surface);
  font-size: 24rpx;
  line-height: 1.4;
}
.spec-chip::after {
  border: 0;
}
.spec-chip--active {
  border-color: var(--theme-accent);
  color: var(--theme-accent);
  background: var(--theme-accent-soft);
}
.spec-value {
  flex: 1;
  color: var(--theme-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}
.tabs-card {
  padding: 0 32rpx 32rpx;
}
.tabs-header {
  display: flex;
  gap: 40rpx;
  border-bottom: 1rpx solid var(--theme-border-soft);
}
.tab-item {
  position: relative;
  padding: 24rpx 0 20rpx;
  color: var(--theme-text-secondary);
  font-size: 26rpx;
  font-weight: 400;
}
.tab-item--active {
  color: var(--theme-text);
  font-weight: 600;
}
.tab-item--active::after {
  position: absolute;
  bottom: -1rpx;
  left: 0;
  width: 100%;
  height: 4rpx;
  border-radius: 2rpx;
  background: var(--theme-accent);
  content: '';
}
.tab-content {
  padding-top: 24rpx;
}
.tab-body {
  color: var(--theme-text-secondary);
  font-size: 24rpx;
  line-height: 1.8;
}
.bottom-spacer {
  height: 48rpx;
}
.purchase-bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 24rpx;
  padding: 16rpx 32rpx calc(env(safe-area-inset-bottom) + 16rpx);
  border-top: 1rpx solid var(--theme-border-soft);
  background: var(--theme-surface);
}
.advisor {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  align-items: center;
  gap: 4rpx;
}
.advisor .icon {
  width: 36rpx;
  height: 36rpx;
}
.advisor-label {
  color: var(--theme-text-secondary);
  font-size: 20rpx;
}
.buttons {
  display: flex;
  flex: 1;
  gap: 16rpx;
}
.btn {
  flex: 1;
  margin: 0;
  padding: 0 36rpx;
  border-radius: 999rpx;
  font-size: 26rpx;
  font-weight: 600;
  line-height: 72rpx;
}
.btn::after {
  border: 0;
}
.btn--outline {
  border: 1rpx solid var(--theme-accent);
  color: var(--theme-accent);
  background: transparent;
}
.btn--solid {
  color: #ffffff;
  background: var(--theme-accent);
}
</style>
