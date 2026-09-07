<!-- 在售商品列表：搜索 / 品类筛选 / 排序 / 分页 / 上下架，字段对齐竞品奢当家 P04。 -->
<script setup lang="ts">
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app';
import type { CategoryResponse, ProductResponse, SortOrder } from '@saas/contracts';
import { computed, ref } from 'vue';

import { listCategories, listProducts, unlistProduct } from '../../api/modules/product.api';
import StatePanel from '../../components/common/StatePanel.vue';
import { useAppTheme } from '../../composables/use-app-theme';
import { absoluteMediaUrl } from '../../utils/media-url';

const { themeClass } = useAppTheme();
const PAGE_SIZE = 20;

/** 成色展示映射（竞品口径）。 */
const CONDITION_TEXT: Record<string, string> = {
  new: '全新',
  excellent: '闲置未使用',
  good: '二手',
  fair: '明显痕迹',
};

interface SortOption {
  label: string;
  sortBy: 'createdAt' | 'price' | 'stock';
  sortOrder: SortOrder;
}
const sortOptions: SortOption[] = [
  { label: '最新上架', sortBy: 'createdAt', sortOrder: 'desc' },
  { label: '价格从低到高', sortBy: 'price', sortOrder: 'asc' },
  { label: '价格从高到低', sortBy: 'price', sortOrder: 'desc' },
  { label: '库存多到少', sortBy: 'stock', sortOrder: 'desc' },
];

const keyword = ref('');
const categories = ref<CategoryResponse[]>([]);
const activeCategoryId = ref('');
const activeSort = ref<SortOption>(sortOptions[0]!);

const products = ref<ProductResponse[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const loadingMore = ref(false);
const errorMessage = ref<string | null>(null);

const hasMore = computed(() => products.value.length < total.value);

let keywordTimer: ReturnType<typeof setTimeout> | undefined;

async function loadCategories(): Promise<void> {
  try {
    categories.value = await listCategories();
  } catch {
    categories.value = [];
  }
}

async function loadProducts(reset: boolean): Promise<void> {
  if (loading.value) return;
  if (reset) {
    page.value = 1;
    loading.value = true;
    errorMessage.value = null;
  } else {
    if (!hasMore.value || loadingMore.value) return;
    loadingMore.value = true;
  }
  try {
    const result = await listProducts({
      status: 'active',
      page: page.value,
      pageSize: PAGE_SIZE,
      keyword: keyword.value.trim() || undefined,
      categoryId: activeCategoryId.value || undefined,
      sortBy: activeSort.value.sortBy,
      sortOrder: activeSort.value.sortOrder,
    });
    total.value = result.total;
    products.value = reset ? result.list : [...products.value, ...result.list];
    if (!reset) page.value += 1;
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '加载在售商品失败';
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function handleSearchInput(): void {
  if (keywordTimer) clearTimeout(keywordTimer);
  keywordTimer = setTimeout(() => void loadProducts(true), 400);
}

function handleSelectCategory(id: string): void {
  activeCategoryId.value = activeCategoryId.value === id ? '' : id;
  void loadProducts(true);
}

function handleSelectSort(option: SortOption): void {
  activeSort.value = option;
  void loadProducts(true);
}

function primaryImage(product: ProductResponse): string {
  return absoluteMediaUrl(product.primaryImage ?? product.images[0]?.url ?? '');
}

function conditionText(product: ProductResponse): string {
  return CONDITION_TEXT[product.attributes.conditionGrade ?? ''] ?? '';
}

function handleOpen(product: ProductResponse): void {
  void uni.navigateTo({ url: `/pages/products/detail?id=${encodeURIComponent(product.id)}` });
}

async function handleUnlist(product: ProductResponse): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    void uni.showModal({
      title: '下架商品',
      content: `确认下架「${product.name}」？下架后消费者将无法购买。`,
      confirmColor: '#D4A359',
      success: (res) => resolve(res.confirm),
      fail: () => resolve(false),
    });
  });
  if (!confirmed) return;
  try {
    await unlistProduct(product.id, { version: product.version, reason: '商家端下架' });
    products.value = products.value.filter((item) => item.id !== product.id);
    total.value = Math.max(0, total.value - 1);
    void uni.showToast({ title: '已下架', icon: 'success' });
  } catch (error: unknown) {
    void uni.showToast({
      title: error instanceof Error ? error.message : '下架失败',
      icon: 'none',
    });
  }
}

onLoad(async () => {
  await loadCategories();
  await loadProducts(true);
});
onShow(() => {
  if (products.value.length) void loadProducts(true);
});
onPullDownRefresh(async () => {
  await loadProducts(true);
  uni.stopPullDownRefresh();
});
onReachBottom(() => void loadProducts(false));
</script>

<template>
  <view class="page" :class="themeClass">
    <!-- 搜索 -->
    <view class="search-shell">
      <image class="search-icon" src="/static/icons/search.png" mode="aspectFit" />
      <input
        v-model="keyword"
        class="search-input"
        placeholder="搜索名称、描述、独立编码"
        placeholder-class="search-placeholder"
        confirm-type="search"
        @input="handleSearchInput"
      />
      <text v-if="total" class="total-tag">在售 {{ total }}</text>
    </view>

    <!-- 品类筛选 -->
    <scroll-view class="chips" scroll-x enable-flex :show-scrollbar="false">
      <view class="chip-list">
        <view
          class="chip"
          :class="{ 'chip--active': activeCategoryId === '' }"
          @click="handleSelectCategory('')"
        >
          全部
        </view>
        <view
          v-for="category in categories"
          :key="category.id"
          class="chip"
          :class="{ 'chip--active': activeCategoryId === category.id }"
          @click="handleSelectCategory(category.id)"
        >
          {{ category.name }}
        </view>
      </view>
    </scroll-view>

    <!-- 排序 -->
    <scroll-view class="chips sort-chips" scroll-x enable-flex :show-scrollbar="false">
      <view class="chip-list">
        <view
          v-for="option in sortOptions"
          :key="option.label"
          class="chip chip--sort"
          :class="{ 'chip--active': activeSort.label === option.label }"
          @click="handleSelectSort(option)"
        >
          {{ option.label }}
        </view>
      </view>
    </scroll-view>

    <!-- 状态与列表 -->
    <view v-if="errorMessage" class="state-area">
      <StatePanel
        eyebrow="加载失败"
        title="在售商品加载失败"
        :description="errorMessage"
        action-label="重新加载"
        @action="loadProducts(true)"
      />
    </view>
    <view v-else-if="loading && !products.length" class="state-area">
      <StatePanel eyebrow="加载中" title="正在加载" description="正在读取在售商品，请稍候。" />
    </view>
    <view v-else-if="!products.length" class="state-area">
      <StatePanel
        eyebrow="暂无在售"
        title="还没有在售商品"
        description="发布商品后，将在这里展示在售中的商品。"
      />
    </view>
    <view v-else class="product-list">
      <view
        v-for="product in products"
        :key="product.id"
        class="product-card"
        @click="handleOpen(product)"
      >
        <image class="thumb" :src="primaryImage(product)" mode="aspectFill" lazy-load />
        <view class="info">
          <view class="name-row">
            <text class="name">{{ product.name }}</text>
          </view>
          <view class="tags">
            <text v-if="conditionText(product)" class="tag">{{ conditionText(product) }}</text>
            <text class="tag tag--stock">库存 {{ product.availableStockQty }}</text>
          </view>
          <view class="price-row">
            <text class="price">¥ {{ product.minimumPrice }}</text>
            <text class="unlist" @click.stop="handleUnlist(product)">下架</text>
          </view>
        </view>
      </view>

      <view v-if="loadingMore" class="load-more">
        <text class="load-more-text">加载更多…</text>
      </view>
      <view v-else-if="!hasMore" class="load-more">
        <text class="load-more-text">已显示全部 {{ total }} 件在售商品</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '../../styles/tokens.scss';
.page {
  min-height: 100vh;
  padding: 24rpx 32rpx 48rpx;
  color: var(--theme-text);
  background: var(--theme-bg);
}

/* ===== 搜索 ===== */
.search-shell {
  display: flex;
  align-items: center;
  gap: 16rpx;
  height: 76rpx;
  padding: 0 28rpx;
  border-radius: 999rpx;
  background: var(--theme-surface);
  box-shadow: $shadow-luxury;
}
.search-icon {
  width: 32rpx;
  height: 32rpx;
  flex-shrink: 0;
}
.search-input {
  flex: 1;
  color: var(--theme-text);
  font-size: 26rpx;
}
.search-placeholder {
  color: var(--theme-text-muted);
}
.total-tag {
  flex-shrink: 0;
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  color: var(--theme-accent);
  background: var(--theme-accent-soft);
  font-size: 22rpx;
  font-weight: 600;
}

/* ===== 筛选 chips ===== */
.chips {
  margin-top: 20rpx;
  white-space: nowrap;
}
.chip-list {
  display: flex;
  gap: 16rpx;
}
.chip {
  flex-shrink: 0;
  padding: 12rpx 28rpx;
  border: 1rpx solid var(--theme-border);
  border-radius: 999rpx;
  background: var(--theme-surface);
  color: var(--theme-text-secondary);
  font-size: 24rpx;
  white-space: nowrap;
}
.chip--active {
  border-color: var(--theme-accent);
  background: var(--theme-accent-soft);
  color: var(--theme-accent);
  font-weight: 600;
}
.chip--sort {
  padding: 12rpx 24rpx;
  font-size: 22rpx;
}
.sort-chips {
  margin-top: 12rpx;
}

/* ===== 列表 ===== */
.state-area {
  padding: 32rpx 0;
}
.product-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 24rpx;
}
.product-card {
  display: flex;
  gap: 24rpx;
  padding: 20rpx;
  border-radius: $radius-card;
  background: var(--theme-surface);
  box-shadow: $shadow-luxury;
}
.thumb {
  width: 160rpx;
  height: 160rpx;
  flex-shrink: 0;
  border-radius: 16rpx;
  background: var(--theme-accent-soft);
}
.info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
  padding: 4rpx 0;
}
.name-row {
  display: flex;
  align-items: center;
}
.name {
  overflow: hidden;
  color: var(--theme-text);
  font-size: 28rpx;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tags {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.tag {
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  color: var(--theme-text-secondary);
  background: var(--theme-bg);
  font-size: 20rpx;
}
.tag--stock {
  color: var(--theme-text-muted);
}
.price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.price {
  color: var(--theme-accent);
  font-family: $font-mono;
  font-size: 30rpx;
  font-weight: 700;
}
.unlist {
  padding: 8rpx 22rpx;
  border: 1rpx solid var(--theme-border);
  border-radius: 999rpx;
  color: var(--theme-text-secondary);
  font-size: 22rpx;
}
.load-more {
  padding: 24rpx 0 8rpx;
  text-align: center;
}
.load-more-text {
  color: var(--theme-text-muted);
  font-size: 22rpx;
}
</style>
