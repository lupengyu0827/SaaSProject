<!-- 商家商品详情页：展示完整商品资料、SKU 库存与经营履历，并提供编辑、锁单、解锁、下架、开单等经营操作。 -->
<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import type {
  ProductLifecycleEventResponse,
  ProductResponse,
  ProductStatus,
  ProductVariantResponse,
} from '@saas/contracts';
import { computed, reactive, ref, shallowRef } from 'vue';

import {
  getProduct,
  listProductLifecycleEvents,
  relistProduct,
  unlistProduct,
} from '../../api/modules/product.api';
import { lockInventory, unlockInventory } from '../../api/modules/inventory.api';
import StatePanel from '../../components/common/StatePanel.vue';
import { useAppTheme } from '../../composables/use-app-theme';
import { absoluteMediaUrl } from '../../utils/media-url';

const { themeClass } = useAppTheme();

/** 商品状态文案：与商品管理列表口径一致。 */
const STATUS_TEXT: Record<ProductStatus, string> = {
  draft: '草稿',
  active: '在售',
  archived: '下架',
  sold: '已售',
};
/** 成色等级文案，与在售商品列表一致。 */
const CONDITION_GRADE_TEXT: Record<string, string> = {
  new: '全新',
  excellent: '闲置未使用',
  good: '二手',
  fair: '明显痕迹',
};
/** 使用状态文案。 */
const USAGE_CONDITION_TEXT: Record<string, string> = {
  unused: '闲置未使用',
  preowned: '二手',
};
/** 鉴定状态文案。 */
const AUTHENTICITY_TEXT: Record<string, string> = {
  pending: '待鉴定',
  authenticated: '已鉴定',
  rejected: '未通过',
};
/** 保卡状态文案。 */
const WARRANTY_TEXT: Record<string, string> = {
  present: '有',
  absent: '无',
};
/** 附件文案，与入库页选项一致。 */
const ACCESSORY_TEXT: Record<string, string> = {
  none: '无',
  box: '包装盒',
  invoice: '发票',
  receipt: '收据',
  warranty_card: '保卡',
  identity_card: '身份证',
  dust_bag: '防尘袋',
  manual: '说明书',
  bag: '品牌包',
};
/** 生命周期事件文案。 */
const LIFECYCLE_TEXT: Record<string, string> = {
  published: '发布上架',
  unlisted: '下架',
  relisted: '重新上架',
  sold: '标记为已售',
};

type InventoryOp = 'lock' | 'unlock';

const productId = ref('');
const product = shallowRef<ProductResponse | null>(null);
const events = shallowRef<ProductLifecycleEventResponse[]>([]);
const loading = ref(true);
const errorMessage = ref<string | null>(null);
const submitting = ref(false);

/** 锁单/解锁弹层状态。 */
const invSheet = reactive<{
  show: boolean;
  op: InventoryOp;
  quantities: Record<string, number>;
  busy: boolean;
}>({
  show: false,
  op: 'lock',
  quantities: {},
  busy: false,
});

/** 主图优先、其余按排序号排列的图片墙。 */
const galleryImages = computed<string[]>(() => {
  const current = product.value;
  if (!current) return [];
  const sorted = [...current.images].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
    return left.sortOrder - right.sortOrder;
  });
  const urls = sorted
    .map((image) => absoluteMediaUrl(image.url))
    .filter((url): url is string => Boolean(url));
  if (urls.length > 0) return urls;
  const primary = absoluteMediaUrl(current.primaryImage ?? '');
  return primary ? [primary] : [];
});

/** 是否仅单张图片（决定走大图布局还是九宫格）。 */
const hasSingleImage = computed(() => galleryImages.value.length === 1);

const statusText = computed(() => (product.value ? STATUS_TEXT[product.value.status] : ''));

/** 价格：单规格直接展示，多规格展示区间。 */
const priceText = computed(() => {
  const current = product.value;
  if (!current) return '—';
  if (current.minimumPrice === current.maximumPrice) return `¥ ${current.minimumPrice}`;
  return `¥ ${current.minimumPrice} ~ ¥ ${current.maximumPrice}`;
});

/** 库存：可用 / 总量。 */
const stockText = computed(() => {
  const current = product.value;
  if (!current) return '—';
  return `${current.availableStockQty} / ${current.stockQty}`;
});

/** 属性行：只展示有值的字段，避免空白占位。 */
const attributeRows = computed<Array<{ label: string; value: string }>>(() => {
  const attributes = product.value?.attributes;
  if (!attributes) return [];
  let accessoryText: string | null = null;
  if (attributes.accessories) {
    const items = attributes.accessories.filter((item) => item !== 'none');
    accessoryText = items.length
      ? items.map((item) => ACCESSORY_TEXT[item] ?? item).join('、')
      : '无';
  }
  const rows: Array<[string, string | number | undefined | null]> = [
    ['成色', CONDITION_GRADE_TEXT[attributes.conditionGrade ?? '']],
    ['使用状态', USAGE_CONDITION_TEXT[attributes.usageCondition ?? '']],
    ['材质', attributes.material],
    ['颜色', attributes.color],
    ['尺寸', attributes.size],
    ['年份', attributes.year],
    ['产地', attributes.origin],
    ['系列', attributes.seriesName],
    ['型号', attributes.modelName],
    ['官方指导价', attributes.officialGuidePrice ? `¥ ${attributes.officialGuidePrice}` : null],
    ['鉴定状态', AUTHENTICITY_TEXT[attributes.authenticityStatus ?? '']],
    ['鉴定机构', attributes.appraisalOrganization],
    ['证书编号', attributes.appraisalCertificateNo],
    ['序列号', attributes.serialNumber],
    [
      '商品保卡',
      attributes.warrantyCard
        ? `${WARRANTY_TEXT[attributes.warrantyCard] ?? attributes.warrantyCard}${
            attributes.warrantyCardYear ? `（${attributes.warrantyCardYear} 年）` : ''
          }`
        : null,
    ],
    ['适用人群', attributes.audience],
    ['附件', accessoryText],
    ['标签', attributes.tags?.length ? attributes.tags.join('、') : null],
    ['内部备注', attributes.remarks],
  ];
  return rows
    .filter((row): row is [string, string | number] => row[1] !== undefined && row[1] !== null && row[1] !== '')
    .map(([label, value]) => ({ label, value: String(value) }));
});

const currentStatus = computed<ProductStatus | null>(() => product.value?.status ?? null);

/** 商品是否存在锁定库存（任一规格 lockedQty > 0 即视为处于"锁单"状态）。 */
const hasLockedStock = computed(() => {
  const current = product.value;
  if (!current) return false;
  return current.variants.some((variant) => variant.stockQty - variant.availableStockQty > 0);
});

type FooterAction = {
  key: string;
  label: string;
  variant: 'primary' | 'secondary' | 'danger';
  action: string;
  /** 主操作按钮（开单），右侧更大展示。 */
  primary?: boolean;
};

/** 底部操作区按钮渲染策略（按状态）。锁单/解锁互斥：有锁定库存展示解锁，否则展示锁单。 */
const footerActions = computed<FooterAction[]>(() => {
  const status = currentStatus.value;
  if (!status) return [];
  const actions: FooterAction[] = [];
  if (status === 'draft') {
    actions.push({ key: 'edit', label: '编辑草稿', variant: 'secondary', action: 'edit' });
    actions.push({ key: 'order', label: '开单', variant: 'primary', action: 'order', primary: true });
  } else if (status === 'active') {
    actions.push(
      hasLockedStock.value
        ? { key: 'unlock', label: '解锁', variant: 'secondary', action: 'unlock' }
        : { key: 'lock', label: '锁单', variant: 'secondary', action: 'lock' },
    );
    actions.push({ key: 'unlist', label: '下架', variant: 'danger', action: 'unlist' });
    actions.push({ key: 'order', label: '开单', variant: 'primary', action: 'order', primary: true });
  } else if (status === 'archived') {
    actions.push({ key: 'relist', label: '重新上架', variant: 'secondary', action: 'relist' });
    actions.push({ key: 'order', label: '开单', variant: 'primary', action: 'order', primary: true });
  }
  return actions;
});

const showFooter = computed(() => footerActions.value.length > 0);
const showSoldNote = computed(() => currentStatus.value === 'sold');

/** 将 SKU 规格安全转成短文本。 */
function variantSpecText(variant: ProductVariantResponse): string {
  const specs = variant.specs;
  if (typeof specs !== 'object' || specs === null || Array.isArray(specs)) return '默认规格';
  const values = Object.values(specs as Record<string, unknown>).filter(
    (value): value is string | number => typeof value === 'string' || typeof value === 'number',
  );
  return values.length > 0 ? values.join(' · ') : '默认规格';
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (input: number): string => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

async function loadEvents(id: string): Promise<void> {
  try {
    events.value = await listProductLifecycleEvents(id);
  } catch {
    events.value = [];
  }
}

async function loadProduct(): Promise<void> {
  if (!productId.value) {
    errorMessage.value = '商品编号无效，请返回商品列表重试';
    loading.value = false;
    return;
  }
  loading.value = true;
  errorMessage.value = null;
  try {
    const detail = await getProduct(productId.value);
    product.value = detail;
    await loadEvents(detail.id);
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '加载商品详情失败';
  } finally {
    loading.value = false;
  }
}

function handlePreviewImage(index: number): void {
  const urls = galleryImages.value;
  if (!urls.length) return;
  void uni.previewImage({ current: urls[index] ?? urls[0]!, urls });
}

async function confirmAction(title: string, content: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    uni.showModal({
      title,
      content,
      confirmColor: '#D4A359',
      success: (result) => resolve(result.confirm),
      fail: () => resolve(false),
    });
  });
}

async function runLifecycle(
  action: 'unlist' | 'relist',
  title: string,
  content: string,
  reason: string,
): Promise<void> {
  const current = product.value;
  if (!current || submitting.value) return;
  const confirmed = await confirmAction(title, content);
  if (!confirmed) return;
  submitting.value = true;
  try {
    const updated =
      action === 'unlist'
        ? await unlistProduct(current.id, { version: current.version, reason })
        : await relistProduct(current.id, { version: current.version, reason });
    product.value = updated;
    await loadEvents(updated.id);
    void uni.showToast({ title: action === 'unlist' ? '已下架' : '已重新上架', icon: 'success' });
  } catch (error: unknown) {
    void uni.showToast({
      title: error instanceof Error ? error.message : '操作失败，请重试',
      icon: 'none',
    });
  } finally {
    submitting.value = false;
  }
}

function handleUnlist(): void {
  void runLifecycle(
    'unlist',
    '下架商品',
    '下架后消费者将无法看到该商品，可在下架列表中重新上架。',
    '商家端下架',
  );
}

function handleRelist(): void {
  void runLifecycle(
    'relist',
    '重新上架',
    '重新上架后消费者可以再次看到并购买该商品。',
    '商家端重新上架',
  );
}

function handleEdit(): void {
  const current = product.value;
  if (!current) return;
  void uni.navigateTo({ url: `/pages/products/editor?id=${encodeURIComponent(current.id)}` });
}

/** 跳转到开单页并携带商品/首个规格参数，供开单页后续选择使用。 */
function handleCreateOrder(): void {
  const current = product.value;
  if (!current) return;
  const firstVariant = current.variants[0];
  const params = new URLSearchParams({ productId: current.id });
  if (firstVariant) params.set('variantId', firstVariant.id);
  void uni.navigateTo({ url: `/pages/order/index?${params.toString()}` });
}

/** 打开锁单/解锁弹层。 */
function openInventorySheet(op: InventoryOp): void {
  const current = product.value;
  if (!current || !current.variants.length) {
    void uni.showToast({ title: '该商品暂无可操作的规格', icon: 'none' });
    return;
  }
  invSheet.op = op;
  invSheet.quantities = Object.fromEntries(current.variants.map((variant) => [variant.id, 1]));
  invSheet.show = true;
}

/** 调整某个规格在弹层中的锁/解锁数量。 */
function adjustQuantity(variantId: string, delta: number): void {
  const variant = product.value?.variants.find((item) => item.id === variantId);
  if (!variant) return;
  const max = invSheet.op === 'lock' ? variant.availableStockQty : variant.stockQty - variant.availableStockQty;
  const next = Math.min(max, Math.max(0, (invSheet.quantities[variantId] ?? 0) + delta));
  invSheet.quantities[variantId] = next;
}

/** 提交锁单/解锁。变体独立提交，单个失败不影响其它。 */
async function submitInventorySheet(): Promise<void> {
  const current = product.value;
  if (!current || invSheet.busy) return;
  const tasks = current.variants
    .map((variant) => ({ variant, qty: invSheet.quantities[variant.id] ?? 0 }))
    .filter((entry) => entry.qty > 0);
  if (!tasks.length) {
    void uni.showToast({ title: '请填写数量', icon: 'none' });
    return;
  }
  invSheet.busy = true;
  const results = await Promise.allSettled(
    tasks.map(({ variant, qty }) =>
      invSheet.op === 'lock'
        ? lockInventory(variant.id, qty)
        : unlockInventory(variant.id, qty),
    ),
  );
  invSheet.busy = false;
  const failed = results.filter((entry) => entry.status === 'rejected').length;
  const succeeded = results.length - failed;
  if (failed === 0) {
    invSheet.show = false;
    void uni.showToast({
      title: invSheet.op === 'lock' ? `已锁定 ${succeeded} 个规格` : `已解锁 ${succeeded} 个规格`,
      icon: 'success',
    });
  } else {
    void uni.showToast({
      title: `${succeeded} 成功 / ${failed} 失败`,
      icon: 'none',
    });
  }
  await loadProduct();
}

function handleFooterAction(action: string): void {
  switch (action) {
    case 'edit':
      handleEdit();
      return;
    case 'order':
      handleCreateOrder();
      return;
    case 'unlist':
      handleUnlist();
      return;
    case 'relist':
      handleRelist();
      return;
    case 'lock':
      openInventorySheet('lock');
      return;
    case 'unlock':
      openInventorySheet('unlock');
      return;
  }
}

function handleRetry(): void {
  void loadProduct();
}

onLoad((query) => {
  productId.value = typeof query?.id === 'string' ? query.id : '';
  void loadProduct();
});
</script>

<template>
  <view class="page" :class="[themeClass, { 'page--footer': showFooter }]">
    <StatePanel
      v-if="loading"
      eyebrow="PREPARING"
      title="正在读取商品"
      description="正在安全读取商品资料，请稍候。"
    />
    <StatePanel
      v-else-if="errorMessage || !product"
      eyebrow="LOAD ERROR"
      title="商品加载失败"
      :description="errorMessage ?? '商品资料暂不可用'"
      action-label="重新加载"
      @action="handleRetry"
    />
    <template v-else>
      <!-- 图片九宫格（单张大图 / 多张 3 列网格） -->
      <view v-if="galleryImages.length" class="gallery" :class="{ 'gallery--single': hasSingleImage }">
        <view
          v-for="(image, index) in galleryImages"
          :key="`${image}-${index}`"
          class="gallery-item"
          @click="handlePreviewImage(index)"
        >
          <image class="gallery-image" :src="image" mode="aspectFill" />
        </view>
      </view>
      <view v-else class="gallery gallery--empty">
        <text class="empty-monogram">L</text>
        <text class="empty-caption">商品暂无图片</text>
      </view>

      <!-- 商品信息 -->
      <view class="card">
        <view class="info-head">
          <text class="status" :class="`status--${product.status}`">{{ statusText }}</text>
          <text class="code">{{ product.code }}</text>
        </view>
        <text class="name">{{ product.name || '未命名商品' }}</text>
        <view class="metric-row">
          <view class="metric">
            <text class="metric-label">销售价</text>
            <text class="metric-value metric-value--accent">{{ priceText }}</text>
          </view>
          <view class="metric">
            <text class="metric-label">库存（可用 / 总量）</text>
            <text class="metric-value">{{ stockText }}</text>
          </view>
        </view>
        <text class="version">数据版本 v{{ product.version }}</text>
      </view>

      <!-- 商品属性 -->
      <view v-if="attributeRows.length" class="card">
        <view class="card-head">
          <text class="card-title">商品属性</text>
        </view>
        <view v-for="row in attributeRows" :key="row.label" class="attr-row">
          <text class="attr-label">{{ row.label }}</text>
          <text class="attr-value">{{ row.value }}</text>
        </view>
      </view>

      <!-- 规格与库存 -->
      <view v-if="product.variants.length" class="card">
        <view class="card-head">
          <text class="card-title">规格与库存</text>
          <text class="card-meta">共 {{ product.variants.length }} 个规格</text>
        </view>
        <view v-for="variant in product.variants" :key="variant.id" class="sku">
          <view class="sku-head">
            <text class="sku-spec">{{ variantSpecText(variant) }}</text>
            <text class="sku-price">¥ {{ variant.price }}</text>
          </view>
          <view class="sku-meta">
            <text class="sku-code">{{ variant.sku }}</text>
            <text class="sku-stock">可用 {{ variant.availableStockQty }} / 共 {{ variant.stockQty }}</text>
          </view>
          <text class="sku-cost">成本 ¥ {{ variant.costPrice }}</text>
        </view>
      </view>

      <!-- 商品说明 -->
      <view v-if="product.description" class="card">
        <view class="card-head">
          <text class="card-title">商品说明</text>
        </view>
        <text class="description">{{ product.description }}</text>
      </view>

      <!-- 经营履历 -->
      <view v-if="events.length" class="card">
        <view class="card-head">
          <text class="card-title">经营履历</text>
        </view>
        <view v-for="event in events" :key="event.id" class="event">
          <text class="event-type">{{ LIFECYCLE_TEXT[event.type] ?? event.type }}</text>
          <text class="event-time">{{ formatTime(event.occurredAt) }}</text>
          <text v-if="event.reason" class="event-reason">{{ event.reason }}</text>
        </view>
      </view>
    </template>

    <!-- 底部经营操作 -->
    <view v-if="showFooter && !loading" class="footer">
      <button
        v-for="item in footerActions"
        :key="item.key"
        class="btn"
        :class="{
          'btn--primary': item.variant === 'primary',
          'btn--danger': item.variant === 'danger',
          'btn--secondary': item.variant === 'secondary',
          'btn--order': item.primary,
        }"
        :loading="submitting && (item.action === 'unlist' || item.action === 'relist')"
        :disabled="submitting"
        @click="handleFooterAction(item.action)"
      >
        {{ item.label }}
      </button>
    </view>
    <view v-else-if="showSoldNote && !loading" class="footer footer--note">
      <text class="footer-note-text">该商品已售出，无法进行上下架与库存操作</text>
    </view>

    <!-- 锁单 / 解锁弹层 -->
    <view v-if="invSheet.show" class="sheet-mask" @click.self="invSheet.show = false">
      <view class="sheet">
        <view class="sheet-head">
          <text class="sheet-title">{{ invSheet.op === 'lock' ? '锁单' : '解锁' }}</text>
          <text class="sheet-done" @click="invSheet.show = false">取消</text>
        </view>
        <view class="sheet-hint">
          {{
            invSheet.op === 'lock'
              ? '把规格库存从「可用」转入「锁定」，锁定后该数量不可售出'
              : '把规格库存从「锁定」返还「可用」'
          }}
        </view>
        <view v-if="product" class="sheet-body">
          <view v-for="variant in product.variants" :key="variant.id" class="sheet-row">
            <view class="sheet-row-info">
              <text class="sheet-row-spec">{{ variantSpecText(variant) }}</text>
              <text class="sheet-row-meta">
                可用 {{ variant.availableStockQty }} · 共 {{ variant.stockQty }}
              </text>
            </view>
            <view class="stepper">
              <text class="stepper-btn" @click="adjustQuantity(variant.id, -1)">−</text>
              <text class="stepper-value">{{ invSheet.quantities[variant.id] ?? 0 }}</text>
              <text class="stepper-btn" @click="adjustQuantity(variant.id, 1)">＋</text>
            </view>
          </view>
        </view>
        <button
          class="sheet-submit"
          :class="invSheet.op === 'lock' ? 'btn--primary' : 'btn--secondary'"
          :loading="invSheet.busy"
          :disabled="invSheet.busy"
          @click="submitInventorySheet"
        >
          {{ invSheet.op === 'lock' ? '确认锁单' : '确认解锁' }}
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '../../styles/tokens.scss';
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24rpx 32rpx 48rpx;
  color: var(--theme-text);
  background: var(--theme-bg);
}
.page--footer {
  padding-bottom: 240rpx;
}

/* ===== 图片九宫格 ===== */
.gallery {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8rpx;
  padding: 8rpx;
  border: 1rpx solid var(--theme-border);
  border-radius: $radius-card;
  background: var(--theme-surface);
}
.gallery--single {
  display: block;
  padding: 0;
}
.gallery--empty {
  display: flex;
  height: 360rpx;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}
.gallery-item {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 8rpx;
  background: var(--theme-bg);
}
.gallery--single .gallery-item {
  width: 100%;
  aspect-ratio: 1 / 1;
}
.gallery-image {
  width: 100%;
  height: 100%;
}
.empty-monogram {
  color: var(--theme-accent);
  font-family: $font-display;
  font-size: 96rpx;
}
.empty-caption {
  margin-top: 12rpx;
  color: var(--theme-text-muted);
  font-size: 24rpx;
}

/* ===== 卡片 ===== */
.card {
  margin-top: 24rpx;
  padding: 32rpx 28rpx;
  border: 1rpx solid var(--theme-border);
  border-radius: $radius-card;
  background: var(--theme-surface);
}
.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20rpx;
}
.card-title {
  color: var(--theme-text);
  font-family: $font-display;
  font-size: 32rpx;
  font-weight: 700;
}
.card-meta {
  color: var(--theme-text-muted);
  font-size: 22rpx;
}

/* ===== 商品信息 ===== */
.info-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.status {
  padding: 6rpx 20rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;
}
.status--active {
  color: $success-text;
  background: $success-bg;
}
.status--archived,
.status--draft {
  color: $text-secondary;
  background: $bg-muted;
}
.status--sold {
  color: $accent-primary;
  background: $accent-champagne;
}
.code {
  color: var(--theme-text-muted);
  font-family: $font-mono;
  font-size: 22rpx;
}
.name {
  display: block;
  margin-top: 16rpx;
  color: var(--theme-text);
  font-family: $font-display;
  font-size: 38rpx;
  font-weight: 700;
  line-height: 1.4;
}
.metric-row {
  display: flex;
  gap: 32rpx;
  margin-top: 28rpx;
}
.metric {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}
.metric-label {
  color: var(--theme-text-secondary);
  font-size: 22rpx;
}
.metric-value {
  color: var(--theme-text);
  font-family: $font-mono;
  font-size: 34rpx;
  font-weight: 700;
}
.metric-value--accent {
  color: var(--theme-accent);
}
.version {
  display: block;
  margin-top: 20rpx;
  color: var(--theme-text-muted);
  font-family: $font-mono;
  font-size: 20rpx;
}

/* ===== 属性 ===== */
.attr-row {
  display: flex;
  align-items: flex-start;
  gap: 24rpx;
  padding: 14rpx 0;
  border-top: 1rpx solid var(--theme-border-soft);
}
.attr-label {
  width: 168rpx;
  flex-shrink: 0;
  color: var(--theme-text-secondary);
  font-size: 26rpx;
}
.attr-value {
  flex: 1;
  color: var(--theme-text);
  font-size: 26rpx;
  line-height: 1.6;
}

/* ===== 规格 ===== */
.sku {
  padding: 20rpx 0;
  border-top: 1rpx solid var(--theme-border-soft);
}
.sku-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16rpx;
}
.sku-spec {
  flex: 1;
  color: var(--theme-text);
  font-size: 26rpx;
  font-weight: 600;
}
.sku-price {
  color: var(--theme-accent);
  font-family: $font-mono;
  font-size: 28rpx;
  font-weight: 700;
}
.sku-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 10rpx;
}
.sku-code {
  color: var(--theme-text-muted);
  font-family: $font-mono;
  font-size: 22rpx;
}
.sku-stock {
  color: var(--theme-text-secondary);
  font-family: $font-mono;
  font-size: 22rpx;
}
.sku-cost {
  display: block;
  margin-top: 6rpx;
  color: var(--theme-text-muted);
  font-family: $font-mono;
  font-size: 22rpx;
}

/* ===== 说明 ===== */
.description {
  color: var(--theme-text-secondary);
  font-size: 26rpx;
  line-height: 1.75;
}

/* ===== 履历 ===== */
.event {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 16rpx;
  padding: 14rpx 0;
  border-top: 1rpx solid var(--theme-border-soft);
}
.event-type {
  color: var(--theme-text);
  font-size: 26rpx;
  font-weight: 600;
}
.event-time {
  color: var(--theme-text-muted);
  font-family: $font-mono;
  font-size: 22rpx;
}
.event-reason {
  width: 100%;
  color: var(--theme-text-secondary);
  font-size: 22rpx;
}

/* ===== 底部操作区 ===== */
.footer {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: stretch;
  gap: 16rpx;
  padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid var(--theme-border-soft);
  background: var(--theme-surface);
  box-shadow: 0 -12rpx 32rpx rgba(15, 23, 42, 0.06);
}
.footer--note {
  display: flex;
  align-items: center;
  justify-content: center;
}
.footer-note-text {
  color: var(--theme-text-secondary);
  font-size: 24rpx;
}
.btn {
  flex: 1;
  min-width: 0;
  margin: 0;
  border-radius: 999rpx;
  font-size: 26rpx;
  font-weight: 600;
  line-height: 80rpx;
}
.btn--order {
  flex: 1.7;
  font-size: 30rpx;
  line-height: 92rpx;
}
.btn::after {
  border: 0;
}
.btn--primary {
  border: 0;
  color: #ffffff;
  background: var(--theme-accent);
}
.btn--secondary {
  border: 1rpx solid var(--theme-border);
  color: var(--theme-text);
  background: var(--theme-surface);
}
.btn--danger {
  border: 1rpx solid var(--theme-danger);
  color: var(--theme-danger);
  background: var(--theme-surface);
}

/* ===== 锁单/解锁弹层 ===== */
.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.45);
}
.sheet {
  width: 100%;
  padding: 24rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  border-top-left-radius: 24rpx;
  border-top-right-radius: 24rpx;
  background: var(--theme-bg);
}
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 16rpx;
}
.sheet-title {
  color: var(--theme-text);
  font-family: $font-display;
  font-size: 32rpx;
  font-weight: 700;
}
.sheet-done {
  color: var(--theme-text-muted);
  font-size: 26rpx;
}
.sheet-hint {
  margin-bottom: 16rpx;
  color: var(--theme-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}
.sheet-body {
  max-height: 60vh;
  overflow-y: auto;
}
.sheet-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 18rpx 0;
  border-top: 1rpx solid var(--theme-border-soft);
}
.sheet-row-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
}
.sheet-row-spec {
  color: var(--theme-text);
  font-size: 26rpx;
  font-weight: 600;
}
.sheet-row-meta {
  color: var(--theme-text-muted);
  font-family: $font-mono;
  font-size: 22rpx;
}
.stepper {
  display: flex;
  align-items: center;
  border: 1rpx solid var(--theme-border);
  border-radius: 999rpx;
  overflow: hidden;
}
.stepper-btn {
  display: flex;
  width: 56rpx;
  height: 56rpx;
  align-items: center;
  justify-content: center;
  color: var(--theme-text);
  font-size: 30rpx;
}
.stepper-value {
  min-width: 56rpx;
  color: var(--theme-text);
  font-family: $font-mono;
  font-size: 26rpx;
  text-align: center;
}
.sheet-submit {
  margin-top: 24rpx;
  border-radius: 999rpx;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 88rpx;
}
.sheet-submit::after {
  border: 0;
}
</style>