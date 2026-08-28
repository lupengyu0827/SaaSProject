<!-- 小程序品牌首页：以编辑式陈列呈现主推藏品、分类筛选与双列商品列表。 -->
<script setup lang="ts">
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app';
import type { ProductResponse } from '@saas/contracts';
import { computed, ref, shallowRef } from 'vue';

import { listActiveProducts } from '../../api/modules/product.api';
import HomeProductCard from '../../components/product/HomeProductCard.vue';
import { formatCurrency, getLowestPrice, getPrimaryImage } from '../../utils/product-view';

const PAGE_SIZE = 10;
const ALL_CATEGORY = '全部';
const categories = [ALL_CATEGORY, '高级珠宝', '典藏腕表', '经典箱包'] as const;
const products = shallowRef<ProductResponse[]>([]);
const searchKeyword = ref('');
const activeCategory = ref<string>(ALL_CATEGORY);
const isLoading = ref(false);
const errorMessage = ref<string | null>(null);
const filteredProducts = computed(() => {
  if (activeCategory.value === ALL_CATEGORY) return products.value;
  return products.value.filter((product) => getProductCategory(product) === activeCategory.value);
});
const heroProduct = computed(() => filteredProducts.value[0] ?? products.value[0] ?? null);
const heroImage = computed(() => (heroProduct.value ? getPrimaryImage(heroProduct.value) : null));
const heroPrice = computed(() => {
  if (!heroProduct.value) return null;
  const price = getLowestPrice(heroProduct.value);
  return price ? formatCurrency(price) : null;
});
const sectionTitle = computed(() =>
  searchKeyword.value.trim() ? `“${searchKeyword.value.trim()}” 的结果` : '本周新入藏',
);

/** 加载当前展示商品；Mock 模式和真实接口共用同一契约。 */
async function loadProducts(): Promise<void> {
  if (isLoading.value) return;
  isLoading.value = true;
  errorMessage.value = null;
  try {
    const page = await listActiveProducts({
      search: searchKeyword.value.trim() || undefined,
      limit: PAGE_SIZE,
    });
    products.value = page.items;
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '加载藏品失败，请稍后重试';
  } finally {
    isLoading.value = false;
  }
}

function handleSearch(): void {
  activeCategory.value = ALL_CATEGORY;
  void loadProducts();
}

function handleClearSearch(): void {
  searchKeyword.value = '';
  void loadProducts();
}

function handleSelectCategory(category: string): void {
  activeCategory.value = category;
}

function handleOpenHero(): void {
  if (!heroProduct.value) return;
  void uni.navigateTo({
    url: `/pages/product/detail?id=${encodeURIComponent(heroProduct.value.id)}`,
  });
}

function getProductCategory(product: ProductResponse): string | null {
  if (typeof product.attributes !== 'object' || product.attributes === null) return null;
  const category = (product.attributes as Record<string, unknown>).category;
  return typeof category === 'string' ? category : null;
}

onLoad(() => {
  void loadProducts();
});
onPullDownRefresh(async () => {
  await loadProducts();
  uni.stopPullDownRefresh();
});
</script>

<template>
  <view class="page">
    <view class="brand-header">
      <view class="brand-lockup">
        <text class="brand-name">L'ATELIER</text>
        <text class="brand-caption">PRIVATE COLLECTION</text>
      </view>
    </view>

    <view class="search-section">
      <view class="search-shell">
        <text class="search-symbol">⌕</text>
        <input
          v-model="searchKeyword"
          class="search-input"
          confirm-type="search"
          placeholder="搜索藏品、编号"
          placeholder-class="search-placeholder"
          @confirm="handleSearch"
        />
        <text v-if="searchKeyword" class="clear-action" @click="handleClearSearch">清除</text>
      </view>
    </view>

    <view v-if="heroProduct" class="hero" @click="handleOpenHero">
      <image v-if="heroImage" class="hero-image" :src="heroImage" mode="aspectFill" />
      <view class="hero-content">
        <view class="hero-meta">
          <text class="hero-kicker">EDITOR'S SELECTION</text>
          <text class="hero-code">{{ heroProduct.code }}</text>
        </view>
        <text class="hero-title">{{ heroProduct.name }}</text>
        <view class="hero-footer">
          <text class="hero-price">{{ heroPrice }}</text>
          <text class="hero-link">查看藏品档案&nbsp; →</text>
        </view>
      </view>
    </view>

    <view class="service-strip">
      <view class="service-item">
        <text class="service-mark">✓</text>
        <text>专业鉴定</text>
      </view>
      <view class="service-item">
        <text class="service-mark">✓</text>
        <text>一物一档</text>
      </view>
      <view class="service-item">
        <text class="service-mark">✓</text>
        <text>顺丰保价</text>
      </view>
    </view>

    <scroll-view class="category-scroll" scroll-x enable-flex :show-scrollbar="false">
      <view class="category-list">
        <button
          v-for="category in categories"
          :key="category"
          class="category-button"
          :class="{ 'category-button--active': activeCategory === category }"
          @click="handleSelectCategory(category)"
        >
          {{ category }}
        </button>
      </view>
    </scroll-view>

    <view class="collection-section">
      <view class="section-heading">
        <view>
          <text class="section-kicker">CURATED OBJECTS</text>
          <text class="section-title">{{ sectionTitle }}</text>
        </view>
        <text class="section-count">{{ filteredProducts.length }} 件</text>
      </view>

      <view v-if="filteredProducts.length" class="product-grid">
        <HomeProductCard v-for="product in filteredProducts" :key="product.id" :product="product" />
      </view>

      <view v-else-if="isLoading" class="compact-state">
        <text class="state-title">正在整理藏品陈列</text>
        <text class="state-copy">请稍候，精品档案即将呈现</text>
      </view>

      <view v-else class="compact-state">
        <text class="state-title">暂时没有匹配的藏品</text>
        <text class="state-copy">{{ errorMessage ?? '换个关键词或分类再看看' }}</text>
        <button class="state-action" @click="handleClearSearch">查看全部藏品</button>
      </view>
    </view>

    <view class="atelier-note">
      <text class="note-monogram">L</text>
      <text class="note-title">每一件旧物，都有继续被珍视的理由</text>
      <text class="note-copy">甄选值得再次进入生活的珠宝、腕表与经典皮具。</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
@use '../../styles/tokens.scss' as *;

.page {
  min-height: 100vh;
  padding-bottom: calc(72rpx + env(safe-area-inset-bottom));
  background: #f4f1eb;
}
.brand-header {
  min-height: 112rpx;
  padding: calc(env(safe-area-inset-top) + 68rpx) 220rpx 24rpx 32rpx;
  background: $bg-dark-base;
}
.brand-lockup,
.brand-name,
.brand-caption,
.section-kicker,
.section-title,
.state-title,
.state-copy,
.note-monogram,
.note-title,
.note-copy {
  display: block;
}
.brand-name {
  color: #f1dfb6;
  font-family: $font-display;
  font-size: 32rpx;
  letter-spacing: 7rpx;
  white-space: nowrap;
}
.brand-caption {
  margin-top: 4rpx;
  color: #8e929b;
  font-family: $font-mono;
  font-size: 13rpx;
  letter-spacing: 3rpx;
  white-space: nowrap;
}
.search-section {
  padding: 24rpx 24rpx 20rpx;
  background: $bg-dark-base;
}
.search-shell {
  display: flex;
  align-items: center;
  height: 80rpx;
  padding: 0 24rpx;
  border: 1rpx solid rgba(241, 223, 182, 0.22);
  border-radius: 12rpx;
  background: #121720;
}
.search-symbol {
  color: #c8a96b;
  font-size: 30rpx;
}
.search-input {
  flex: 1;
  height: 80rpx;
  margin-left: 16rpx;
  color: $text-dark-primary;
  font-size: 24rpx;
}
.search-placeholder {
  color: #727987;
}
.clear-action {
  padding-left: 24rpx;
  color: #d9bf88;
  font-size: 21rpx;
  white-space: nowrap;
}
.hero {
  margin: 24rpx;
  overflow: hidden;
  border-radius: 8rpx;
  background: $bg-surface;
  box-shadow: 0 18rpx 48rpx rgba(68, 54, 35, 0.12);
}
.hero-image {
  display: block;
  width: 100%;
  height: 620rpx;
  background: #ddd6c9;
}
.hero-content {
  padding: 28rpx 28rpx 32rpx;
}
.hero-meta,
.hero-footer,
.service-strip,
.service-item,
.section-heading {
  display: flex;
  align-items: center;
}
.hero-meta,
.hero-footer,
.section-heading {
  justify-content: space-between;
  gap: 24rpx;
}
.hero-kicker,
.section-kicker {
  color: #9b642e;
  font-family: $font-mono;
  font-size: 15rpx;
  letter-spacing: 2rpx;
}
.hero-code,
.section-count {
  color: $text-secondary;
  font-family: $font-mono;
  font-size: 17rpx;
}
.hero-title {
  display: block;
  margin-top: 14rpx;
  color: #171b22;
  font-family: $font-display;
  font-size: 38rpx;
  font-weight: 600;
  line-height: 1.4;
}
.hero-footer {
  margin-top: 22rpx;
  padding-top: 22rpx;
  border-top: 1rpx solid #e8e1d5;
}
.hero-price {
  color: #7f4b20;
  font-family: $font-mono;
  font-size: 25rpx;
  font-weight: 600;
}
.hero-link {
  color: #272b32;
  font-size: 21rpx;
  white-space: nowrap;
}
.service-strip {
  justify-content: space-between;
  margin: 0 24rpx;
  padding: 24rpx 8rpx;
  border-top: 1rpx solid #dcd4c6;
  border-bottom: 1rpx solid #dcd4c6;
}
.service-item {
  gap: 8rpx;
  color: #4d5158;
  font-size: 20rpx;
  white-space: nowrap;
}
.service-mark {
  color: #9b642e;
  font-size: 18rpx;
}
.category-scroll {
  width: 100%;
  margin-top: 36rpx;
  white-space: nowrap;
}
.category-list {
  display: flex;
  gap: 12rpx;
  padding: 0 24rpx;
}
.category-button {
  flex: 0 0 auto;
  min-width: 112rpx;
  margin: 0;
  padding: 14rpx 24rpx;
  border: 1rpx solid #d6cec1;
  border-radius: 999rpx;
  color: #62656a;
  background: transparent;
  font-size: 20rpx;
  line-height: 1.4;
  white-space: nowrap;
}
.category-button::after,
.state-action::after {
  border: 0;
}
.category-button--active {
  border-color: #171b22;
  color: #f7f3eb;
  background: #171b22;
}
.collection-section {
  padding: 48rpx 24rpx 0;
}
.section-heading {
  align-items: flex-end;
  margin-bottom: 28rpx;
}
.section-title {
  margin-top: 8rpx;
  color: #171b22;
  font-family: $font-display;
  font-size: 36rpx;
  font-weight: 600;
}
.product-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
}
.compact-state {
  padding: 80rpx 32rpx;
  text-align: center;
}
.state-title {
  color: #171b22;
  font-family: $font-display;
  font-size: 32rpx;
}
.state-copy {
  margin-top: 12rpx;
  color: $text-secondary;
  font-size: 21rpx;
}
.state-action {
  width: 240rpx;
  margin: 28rpx auto 0;
  border-radius: 8rpx;
  color: $text-on-accent;
  background: #171b22;
  font-size: 22rpx;
}
.atelier-note {
  margin: 72rpx 24rpx 0;
  padding: 56rpx 40rpx;
  border-top: 1rpx solid #d6cec1;
  text-align: center;
}
.note-monogram {
  color: #9b642e;
  font-family: $font-display;
  font-size: 50rpx;
}
.note-title {
  margin-top: 18rpx;
  color: #272b32;
  font-family: $font-display;
  font-size: 26rpx;
  line-height: 1.6;
}
.note-copy {
  margin-top: 12rpx;
  color: #7a7d82;
  font-size: 19rpx;
  line-height: 1.7;
}
</style>
