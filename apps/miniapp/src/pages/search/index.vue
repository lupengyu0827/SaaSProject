<!-- 消费者搜索页：按 Figma search 帧还原，历史存在本地，结果走公开商品接口。 -->
<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import type { PublicProductResponse } from '@saas/contracts';
import { computed, ref, shallowRef } from 'vue';

import { listActiveProducts } from '../../api/modules/product.api';
import HomeProductCard from '../../components/product/HomeProductCard.vue';
import { useAppTheme } from '../../composables/use-app-theme';
import { useSafeArea } from '../../composables/use-safe-area';
import { formatCurrency, getLowestPrice, getPrimaryImage } from '../../utils/product-view';

const SEARCH_HISTORY_KEY = 'miniapp.search.history';
const { themeClass } = useAppTheme();
const { statusBarHeight } = useSafeArea();

const keyword = ref('');
const isSearching = ref(false);
const searchError = ref<string | null>(null);
const searchResults = shallowRef<PublicProductResponse[]>([]);
const searchHistory = ref<string[]>([]);

const hotSearches = [
  { label: 'HW Logo系列 极简戒饰', tag: '热销' },
  { label: 'Classic Solitaire 单钻经典', tag: '' },
  { label: 'Forget-Me-Not 勿忘我项链', tag: '新品' },
  { label: '排钻永恒排戒 18K白金', tag: '' },
] as const;

const recommendationProducts = computed(() => searchResults.value.slice(0, 4));

onLoad((query) => {
  searchHistory.value = readHistory();
  const raw = typeof query?.keyword === 'string' ? query.keyword : '';
  const incoming = raw ? decodeURIComponent(raw) : '';
  if (incoming) {
    keyword.value = incoming;
    void handleSearch();
  }
});

function readHistory(): string[] {
  try {
    const raw = uni.getStorageSync(SEARCH_HISTORY_KEY);
    return Array.isArray(raw) ? raw.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function saveHistory(list: string[]): void {
  try {
    uni.setStorageSync(SEARCH_HISTORY_KEY, list);
  } catch {
    // 存储失败不影响主流程
  }
}

function addToHistory(term: string): void {
  const trimmed = term.trim();
  if (!trimmed) return;
  const next = [trimmed, ...searchHistory.value.filter((item) => item !== trimmed)].slice(0, 12);
  searchHistory.value = next;
  saveHistory(next);
}

function removeHistoryItem(item: string): void {
  const next = searchHistory.value.filter((term) => term !== item);
  searchHistory.value = next;
  saveHistory(next);
}

function clearHistory(): void {
  searchHistory.value = [];
  try {
    uni.removeStorageSync(SEARCH_HISTORY_KEY);
  } catch {
    // ignore
  }
}

async function handleSearch(): Promise<void> {
  const trimmed = keyword.value.trim();
  if (!trimmed) return;
  addToHistory(trimmed);
  await performSearch(trimmed);
}

async function performSearch(term: string): Promise<void> {
  isSearching.value = true;
  searchError.value = null;
  try {
    const page = await listActiveProducts({ keyword: term, pageSize: 20 });
    searchResults.value = page.list;
  } catch (error: unknown) {
    searchError.value = error instanceof Error ? error.message : '搜索失败，请稍后重试';
    searchResults.value = [];
  } finally {
    isSearching.value = false;
  }
}

function selectKeyword(term: string): void {
  keyword.value = term;
  void handleSearch();
}

function handleCancel(): void {
  void uni.navigateBack({ delta: 1 });
}

function handleClearInput(): void {
  keyword.value = '';
  searchResults.value = [];
}

function openProduct(product: PublicProductResponse): void {
  void uni.navigateTo({ url: `/pages/product/detail?id=${encodeURIComponent(product.id)}` });
}

function productPrice(product: PublicProductResponse): string {
  const price = getLowestPrice(product);
  return price ? formatCurrency(price) : '价格待询';
}

function productImage(product: PublicProductResponse): string | null {
  return getPrimaryImage(product);
}
</script>

<template>
  <view class="page" :class="themeClass">
    <view class="status-bar" :style="{ height: `${statusBarHeight}px` }" />
    <view class="search-header">
      <view class="search-shell">
        <image class="search-icon" src="/static/figma/home-light/search.svg" mode="aspectFit" />
        <input
          v-model="keyword"
          class="search-input"
          confirm-type="search"
          placeholder="搜索 经典钻戒、绝美对戒、经典链饰..."
          placeholder-class="search-placeholder"
          focus
          @confirm="handleSearch"
        />
        <view v-if="keyword" class="clear-btn" @click="handleClearInput">
          <text class="clear-x">×</text>
        </view>
      </view>
      <text class="cancel-btn" @click="handleCancel">取消</text>
    </view>

    <!-- 空搜索态：历史 + 热门 -->
    <template v-if="!keyword && !searchResults.length">
      <view class="history-section">
        <view class="section-head">
          <text class="section-title">历史搜索</text>
          <image
            v-if="searchHistory.length"
            class="trash-icon"
            src="/static/figma/home-light/layers.svg"
            mode="aspectFit"
            @click="clearHistory"
          />
        </view>
        <view v-if="searchHistory.length" class="history-chips">
          <text
            v-for="item in searchHistory"
            :key="item"
            class="history-chip"
            @click="selectKeyword(item)"
          >
            {{ item }}
            <text class="chip-remove" @click.stop="removeHistoryItem(item)">×</text>
          </text>
        </view>
        <view v-else class="empty-hint">
          <text>暂无搜索历史</text>
        </view>
      </view>

      <view class="hot-section">
        <text class="section-title">热门搜索</text>
        <view class="hot-list">
          <view
            v-for="(item, index) in hotSearches"
            :key="item.label"
            class="hot-item"
            @click="selectKeyword(item.label)"
          >
            <text class="hot-rank" :class="{ 'hot-rank--top': index < 3 }">{{ index + 1 }}</text>
            <text class="hot-label">{{ item.label }}</text>
            <view v-if="item.tag" class="hot-tag">{{ item.tag }}</view>
          </view>
        </view>
      </view>
    </template>

    <!-- 搜索结果 -->
    <template v-else>
      <view class="result-section">
        <view class="result-head">
          <text class="result-title">搜索结果</text>
          <text v-if="!isSearching" class="result-count">{{ searchResults.length }} 件</text>
        </view>
        <view v-if="isSearching" class="state-panel">正在搜索…</view>
        <view v-else-if="searchError" class="state-panel">
          <text>{{ searchError }}</text>
          <text class="retry-action" @click="handleSearch">重试</text>
        </view>
        <view v-else-if="searchResults.length" class="result-grid">
          <HomeProductCard
            v-for="product in searchResults"
            :key="product.id"
            :product="product"
            @click="openProduct(product)"
          />
        </view>
        <view v-else class="state-panel">
          <text>未找到与 “{{ keyword }}” 相关的藏品</text>
          <text class="retry-action" @click="handleClearInput">清除关键词</text>
        </view>
      </view>
    </template>

    <!-- 猜您喜欢：空态或结果不足时展示 -->
    <view v-if="!isSearching && recommendationProducts.length" class="recommend-section">
      <text class="section-title section-title--serif">猜您喜欢 · Custom Recommendations</text>
      <view class="recommend-grid">
        <view
          v-for="product in recommendationProducts"
          :key="product.id"
          class="recommend-card"
          @click="openProduct(product)"
        >
          <image
            v-if="productImage(product)"
            class="recommend-image"
            :src="productImage(product) ?? ''"
            mode="aspectFill"
            lazy-load
          />
          <view class="recommend-copy">
            <text class="recommend-series">{{ product.attributes.material ?? '私人藏品' }}</text>
            <text class="recommend-name">{{ product.name }}</text>
            <view v-if="product.rating != null" class="recommend-rating">
              <image class="star-icon" src="/static/figma/home-light/star.svg" mode="aspectFit" />
              <text class="rating-text">{{ product.rating.toFixed(1) }}{{ product.reviewCount != null ? ` (${product.reviewCount})` : '' }}</text>
            </view>
            <text class="recommend-price">{{ productPrice(product) }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@use '../../styles/tokens.scss' as *;
.page {
  min-height: 100vh;
  padding: 0 0 calc(48rpx + env(safe-area-inset-bottom));
  color: var(--theme-text);
  background: var(--theme-bg);
}
.status-bar {
  width: 100%;
}
.search-header {
  display: flex;
  align-items: center;
  gap: 20rpx;
  height: 88rpx;
  padding: 0 32rpx;
}
.search-shell {
  display: flex;
  flex: 1;
  align-items: center;
  height: 80rpx;
  padding: 0 20rpx;
  border: 1rpx solid var(--theme-border);
  border-radius: 16rpx;
  background: var(--theme-surface);
}
.search-icon {
  width: 28rpx;
  height: 28rpx;
}
.search-input {
  flex: 1;
  min-width: 0;
  height: 80rpx;
  margin-left: 16rpx;
  color: var(--theme-text);
  font-size: 26rpx;
}
.search-placeholder {
  color: var(--theme-text-muted);
}
.clear-btn {
  display: flex;
  width: 44rpx;
  height: 44rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  background: var(--theme-text-muted);
}
.clear-x {
  font-size: 28rpx;
  line-height: 1;
}
.cancel-btn {
  color: var(--theme-text-secondary);
  font-size: 28rpx;
  white-space: nowrap;
}
.history-section,
.hot-section,
.result-section,
.recommend-section {
  padding: 32rpx;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}
.section-title {
  display: block;
  color: var(--theme-text);
  font-size: 28rpx;
  font-weight: 600;
}
.section-title--serif {
  font-family: $font-display;
  font-size: 32rpx;
  font-weight: 700;
}
.trash-icon {
  width: 32rpx;
  height: 32rpx;
}
.history-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.history-chip {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 20rpx;
  border: 1rpx solid var(--theme-border);
  border-radius: 999rpx;
  color: var(--theme-text-secondary);
  background: var(--theme-surface);
  font-size: 24rpx;
}
.chip-remove {
  padding-left: 4rpx;
  color: var(--theme-text-muted);
}
.empty-hint {
  padding: 24rpx 0;
  color: var(--theme-text-muted);
  font-size: 24rpx;
}
.hot-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-top: 20rpx;
}
.hot-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.hot-rank {
  width: 40rpx;
  color: var(--theme-text-muted);
  font-size: 28rpx;
  font-weight: 600;
  text-align: center;
}
.hot-rank--top {
  color: var(--theme-accent);
}
.hot-label {
  flex: 1;
  color: var(--theme-text);
  font-size: 28rpx;
}
.hot-tag {
  padding: 6rpx 14rpx;
  border-radius: 8rpx;
  color: var(--theme-accent);
  background: var(--theme-accent-soft);
  font-size: 20rpx;
}
.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}
.result-title {
  color: var(--theme-text);
  font-size: 28rpx;
  font-weight: 600;
}
.result-count {
  color: var(--theme-text-secondary);
  font-size: 24rpx;
}
.result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24rpx;
}
.state-panel {
  display: flex;
  min-height: 240rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  color: var(--theme-text-secondary);
  font-size: 26rpx;
}
.retry-action {
  color: var(--theme-accent);
  font-weight: 600;
}
.recommend-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24rpx;
  margin-top: 24rpx;
}
.recommend-card {
  overflow: hidden;
  border-radius: 24rpx;
  background: var(--theme-surface);
}
.recommend-image {
  display: block;
  width: 100%;
  height: 320rpx;
  background: var(--theme-border-soft);
}
.recommend-copy {
  padding: 20rpx;
}
.recommend-series {
  display: block;
  color: var(--theme-accent);
  font-family: $font-display;
  font-size: 20rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
}
.recommend-name {
  display: block;
  margin-top: 8rpx;
  overflow: hidden;
  color: var(--theme-text);
  font-size: 26rpx;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recommend-rating {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 8rpx;
}
.star-icon {
  width: 20rpx;
  height: 20rpx;
}
.rating-text {
  color: var(--theme-text-secondary);
  font-size: 20rpx;
}
.recommend-price {
  display: block;
  margin-top: 8rpx;
  color: var(--theme-text);
  font-family: $font-mono;
  font-size: 28rpx;
  font-weight: 700;
}
</style>
