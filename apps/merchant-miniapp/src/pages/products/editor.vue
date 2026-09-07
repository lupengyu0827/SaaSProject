<!-- 商家商品草稿编辑器：自动保存、媒体绑定、预览和原子发布，视觉与消费者端对齐。 -->
<script setup lang="ts">
import { onHide, onLoad, onShow, onUnload } from '@dcloudio/uni-app';
import type { CategoryResponse, ProductResponse, ProductPublishIssue } from '@saas/contracts';
import { computed, reactive, ref, shallowRef, watch } from 'vue';

import {
  bindProductDraftMedia,
  getProduct,
  listCategories,
  publishProductDraft,
  saveProductDraft,
  validateProductDraft,
} from '../../api/modules/product.api';
import type { UploadQueueItem } from '../../composables/media-upload-queue';
import { useAppTheme } from '../../composables/use-app-theme';
import { productDraftFingerprint } from '../../composables/product-draft-autosave';

const { themeClass } = useAppTheme();
const MEDIA_QUEUE_KEY = 'saas.merchant.mediaUploadQueue';
const productId = ref('');
const product = shallowRef<ProductResponse | null>(null);
const categories = shallowRef<CategoryResponse[]>([]);
const loading = ref(true);
const saving = ref(false);
const publishing = ref(false);
const previewing = ref(false);
const initialized = ref(false);
const saveMessage = ref('尚未保存');
const uploadedItems = shallowRef<UploadQueueItem[]>([]);
const form = reactive({
  name: '',
  description: '',
  categoryId: '',
  price: '',
  conditionGrade: 'excellent',
  material: '',
  color: '',
});
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let savedFingerprint = '';
const selectedCategoryIndex = computed(() =>
  Math.max(
    categories.value.findIndex(({ id }) => id === form.categoryId),
    0,
  ),
);
const localImages = computed(() =>
  uploadedItems.value.filter(({ status, assetId }) => status === 'uploaded' && Boolean(assetId)),
);
const previewPrice = computed(() => (form.price.trim() ? `\u00a5 ${form.price.trim()}` : '价格待填写'));

async function loadDraft(): Promise<void> {
  if (!productId.value) return;
  loading.value = true;
  try {
    const [draft, catalog] = await Promise.all([getProduct(productId.value), listCategories()]);
    if (draft.status !== 'draft') throw new Error('该商品已不是可编辑草稿');
    product.value = draft;
    categories.value = catalog.filter(({ status, deletedAt }) => status === 'active' && !deletedAt);
    form.name = draft.name;
    form.description = draft.description ?? '';
    form.categoryId = draft.categoryId ?? '';
    form.price = draft.variants[0]?.price === '0.00' ? '' : (draft.variants[0]?.price ?? '');
    form.conditionGrade = draft.attributes.conditionGrade ?? 'excellent';
    form.material = draft.attributes.material ?? '';
    form.color = draft.attributes.color ?? '';
    savedFingerprint = productDraftFingerprint(form);
    initialized.value = true;
    saveMessage.value = '草稿已同步';
  } catch (error: unknown) {
    void uni.showModal({
      title: '无法打开草稿',
      content: error instanceof Error ? error.message : '请返回重试',
      showCancel: false,
    });
  } finally {
    loading.value = false;
  }
}

async function saveNow(): Promise<ProductResponse | null> {
  if (!initialized.value || !product.value || saving.value) return product.value;
  const pendingFingerprint = productDraftFingerprint(form);
  if (pendingFingerprint === savedFingerprint) return product.value;
  saving.value = true;
  let saveSucceeded = false;
  saveMessage.value = '正在自动保存…';
  try {
    product.value = await saveProductDraft(product.value.id, {
      version: product.value.version,
      name: form.name,
      description: form.description || null,
      categoryId: form.categoryId || null,
      price: form.price || '0.00',
      conditionGrade: form.conditionGrade as 'new' | 'excellent' | 'good' | 'fair',
      material: form.material || null,
      color: form.color || null,
    });
    savedFingerprint = pendingFingerprint;
    saveSucceeded = true;
    saveMessage.value = `已自动保存 \u00b7 v${product.value.version}`;
    return product.value;
  } catch (error: unknown) {
    saveMessage.value = error instanceof Error ? error.message : '自动保存失败';
    return null;
  } finally {
    saving.value = false;
    if (saveSucceeded && productDraftFingerprint(form) !== savedFingerprint) scheduleSave();
  }
}

function scheduleSave(): void {
  if (!initialized.value) return;
  if (saveTimer) clearTimeout(saveTimer);
  if (productDraftFingerprint(form) === savedFingerprint) return;
  saveMessage.value = '有修改待保存';
  saveTimer = setTimeout(() => void saveNow(), 800);
}

function handleCategoryChange(event: { detail: { value: string | number } }): void {
  const category = categories.value[Number(event.detail.value)];
  if (category) form.categoryId = category.id;
}

function handleOpenUpload(): void {
  void uni.navigateTo({ url: '/pages/media/upload' });
}

async function handleBindImages(): Promise<void> {
  const current = await saveNow();
  if (!current) return;
  const assetIds = localImages.value.flatMap(({ assetId }) => (assetId ? [assetId] : []));
  if (!assetIds.length) {
    void uni.showToast({ title: '请先上传至少一张图片', icon: 'none' });
    return;
  }
  try {
    product.value = await bindProductDraftMedia(current.id, {
      assetIds,
      primaryAssetId: assetIds[0]!,
      version: current.version,
    });
    saveMessage.value = `已绑定 ${assetIds.length} 张图片`;
  } catch (error: unknown) {
    void uni.showToast({
      title: error instanceof Error ? error.message : '绑定图片失败',
      icon: 'none',
    });
  }
}

async function handlePublish(): Promise<void> {
  if (publishing.value) return;
  publishing.value = true;
  try {
    const current = await saveNow();
    if (!current) return;
    if (localImages.value.length && current.images.length === 0) await handleBindImages();
    if (!product.value) return;
    const validation = await validateProductDraft(product.value.id);
    if (!validation.valid) {
      await showPublishIssues(validation.issues);
      return;
    }
    const result = await publishProductDraft(product.value.id, { version: product.value.version });
    product.value = result.product;
    await uni.showModal({
      title: '发布成功',
      content: '商品已同步到消费者首页与典藏目录。',
      showCancel: false,
    });
    await uni.navigateBack();
  } catch (error: unknown) {
    void uni.showModal({
      title: '发布失败，草稿已保留',
      content: error instanceof Error ? error.message : '请稍后重试',
      showCancel: false,
    });
  } finally {
    publishing.value = false;
  }
}

function showPublishIssues(issues: ProductPublishIssue[]): Promise<void> {
  return new Promise((resolve) => {
    uni.showModal({
      title: '还不能发布',
      content: issues.map(({ message }) => `\u2022 ${message}`).join('\n'),
      showCancel: false,
      success: () => resolve(),
    });
  });
}

function restoreUploadedItems(): void {
  const stored = uni.getStorageSync<unknown>(MEDIA_QUEUE_KEY);
  uploadedItems.value = Array.isArray(stored) ? stored.filter(isUploadQueueItem) : [];
}
function isUploadQueueItem(value: unknown): value is UploadQueueItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'status' in value &&
    'filePath' in value
  );
}

watch(form, scheduleSave);
onLoad((query) => {
  productId.value = typeof query?.id === 'string' ? query.id : '';
  void loadDraft();
});
onShow(restoreUploadedItems);
onHide(() => void saveNow());
onUnload(() => {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }
  void saveNow();
});
</script>

<template>
  <view class="page" :class="themeClass">
    <view v-if="loading" class="loading-state">正在打开商品草稿…</view>
    <template v-else-if="product">
      <view class="draft-heading">
        <text class="eyebrow">ONE OF ONE OBJECT</text>
        <text class="title">{{ form.name || '未命名草稿' }}</text>
        <view class="save-state">{{ saveMessage }}</view>
      </view>

      <view class="section">
        <view class="section-head">
          <image class="section-icon" src="/static/merchant/image.svg" mode="aspectFit" />
          <text class="section-title">1. 商品图片</text>
        </view>
        <scroll-view v-if="localImages.length" class="image-scroll" scroll-x>
          <view class="image-list">
            <image
              v-for="item in localImages"
              :key="item.id"
              class="image"
              :src="item.filePath"
              mode="aspectFill"
            />
          </view>
        </scroll-view>
        <text v-else class="hint">尚未从手机上传商品图片</text>
        <view class="button-row">
          <view class="btn-secondary" @click="handleOpenUpload">拍照或选择</view>
          <view class="btn-secondary" @click="handleBindImages">绑定到草稿</view>
        </view>
      </view>

      <view class="section">
        <view class="section-head">
          <image class="section-icon" src="/static/merchant/file-text.svg" mode="aspectFit" />
          <text class="section-title">2. 基本资料</text>
        </view>
        <view class="field">
          <text class="label">商品名称</text>
          <view class="input-shell">
            <input v-model="form.name" class="input" maxlength="200" placeholder="例如：黑色粒面皮革手提包" />
          </view>
        </view>
        <view class="field">
          <text class="label">商品分类</text>
          <picker
            :range="categories"
            range-key="name"
            :value="selectedCategoryIndex"
            @change="handleCategoryChange"
          >
            <view class="input-shell picker-display">{{ categories[selectedCategoryIndex]?.name ?? '请选择分类' }}</view>
          </picker>
        </view>
        <view class="field">
          <text class="label">销售价格</text>
          <view class="input-shell">
            <input v-model="form.price" class="input" type="digit" placeholder="0.00" />
          </view>
        </view>
        <view class="field">
          <text class="label">商品说明</text>
          <view class="input-shell textarea-shell">
            <textarea v-model="form.description" class="textarea" maxlength="2000" placeholder="描述品相、附件和值得关注的细节" />
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section-head">
          <image class="section-icon" src="/static/merchant/sparkles.svg" mode="aspectFit" />
          <text class="section-title">3. 成色与属性</text>
        </view>
        <view class="field">
          <text class="label">成色</text>
          <picker
            :range="['全新', '近新', '良好', '有使用痕迹']"
            :value="['new', 'excellent', 'good', 'fair'].indexOf(form.conditionGrade)"
            @change="
              form.conditionGrade =
                ['new', 'excellent', 'good', 'fair'][Number($event.detail.value)] ?? 'excellent'
            "
          >
            <view class="input-shell picker-display">{{
              { new: '全新', excellent: '近新', good: '良好', fair: '有使用痕迹' }[
                form.conditionGrade
              ]
            }}</view>
          </picker>
        </view>
        <view class="field">
          <text class="label">材质</text>
          <view class="input-shell">
            <input v-model="form.material" class="input" placeholder="例如：粒面皮革、18K 金" />
          </view>
        </view>
        <view class="field">
          <text class="label">颜色</text>
          <view class="input-shell">
            <input v-model="form.color" class="input" placeholder="例如：黑色" />
          </view>
        </view>
      </view>

      <view v-if="previewing" class="preview">
        <view class="preview-head">
          <image class="preview-icon" src="/static/merchant/eye.svg" mode="aspectFit" />
          <text class="preview-kicker">CONSUMER PREVIEW</text>
        </view>
        <image
          v-if="localImages[0]"
          class="preview-image"
          :src="localImages[0].filePath"
          mode="aspectFill"
        />
        <text class="preview-name">{{ form.name || '商品名称待填写' }}</text>
        <text class="preview-price">{{ previewPrice }}</text>
        <text class="preview-copy">{{ form.description || '商品说明待填写' }}</text>
      </view>

      <view class="footer-actions">
        <view class="btn-secondary" @click="previewing = !previewing">
          {{ previewing ? '关闭预览' : '消费者预览' }}
        </view>
        <button class="btn-primary" :loading="publishing" @click="handlePublish">
          检查并发布
        </button>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
@import '../../styles/tokens.scss';
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24rpx 32rpx 240rpx;
  color: var(--theme-text);
  background: var(--theme-bg);
}
.loading-state {
  padding: 80rpx 24rpx;
  color: var(--theme-text-secondary);
  text-align: center;
  font-size: 26rpx;
}
.draft-heading {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 8rpx 0 32rpx;
  border-bottom: 1rpx solid var(--theme-border-soft);
}
.eyebrow {
  color: var(--theme-accent);
  font-family: $font-mono;
  font-size: 18rpx;
  letter-spacing: 3rpx;
}
.title {
  color: var(--theme-text);
  font-family: $font-display;
  font-size: 40rpx;
  font-weight: 700;
}
.save-state {
  align-self: flex-start;
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  background: var(--theme-accent-soft);
  color: var(--theme-accent);
  font-size: 22rpx;
  white-space: nowrap;
}
.section {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 24rpx;
  padding: 32rpx 28rpx;
  border-radius: $radius-card;
  background: var(--theme-surface);
  box-shadow: $shadow-luxury;
}
.section-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.section-icon {
  width: 32rpx;
  height: 32rpx;
}
.section-title {
  color: var(--theme-text);
  font-size: 30rpx;
  font-weight: 600;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.label {
  color: var(--theme-text-secondary);
  font-size: 24rpx;
}
.input-shell {
  border: 1rpx solid var(--theme-border);
  border-radius: $radius-control;
  background: var(--theme-bg);
}
.picker-display {
  height: 88rpx;
  padding: 0 24rpx;
  color: var(--theme-text);
  font-size: 26rpx;
  line-height: 88rpx;
}
.input {
  height: 88rpx;
  padding: 0 24rpx;
  line-height: 88rpx;
  color: var(--theme-text);
  font-size: 26rpx;
}
.textarea-shell {
  padding: 4rpx;
}
.textarea {
  box-sizing: border-box;
  width: 100%;
  height: 180rpx;
  padding: 20rpx 24rpx;
  color: var(--theme-text);
  font-size: 26rpx;
  line-height: 1.6;
}
.hint {
  color: var(--theme-text-muted);
  font-size: 24rpx;
  line-height: 1.6;
}
.image-scroll {
  width: 100%;
  white-space: nowrap;
}
.image-list {
  display: flex;
  gap: 16rpx;
}
.image {
  width: 180rpx;
  height: 180rpx;
  flex: 0 0 auto;
  border-radius: $radius-control;
}
.button-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}
.btn-secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 0;
  border: 1rpx solid var(--theme-border);
  border-radius: $radius-control;
  background: var(--theme-surface);
  color: var(--theme-text);
  font-size: 26rpx;
  white-space: nowrap;
}
.preview {
  margin-top: 24rpx;
  padding: 28rpx;
  border-radius: $radius-card;
  background: #0f172a;
}
.preview-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.preview-icon {
  width: 28rpx;
  height: 28rpx;
}
.preview-kicker {
  color: #f59e0b;
  font-family: $font-mono;
  font-size: 18rpx;
  letter-spacing: 3rpx;
}
.preview-image {
  display: block;
  width: 100%;
  height: 600rpx;
  margin-top: 20rpx;
  border-radius: $radius-control;
}
.preview-name {
  display: block;
  margin-top: 16rpx;
  color: #f8fafc;
  font-size: 36rpx;
  font-weight: 600;
}
.preview-price {
  display: block;
  margin-top: 12rpx;
  color: #f59e0b;
  font-family: $font-mono;
  font-size: 32rpx;
  font-weight: 700;
}
.preview-copy {
  display: block;
  margin-top: 16rpx;
  color: #94a3b8;
  font-size: 24rpx;
  line-height: 1.7;
}
.footer-actions {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid var(--theme-border-soft);
  background: var(--theme-surface);
  box-shadow: 0 -12rpx 32rpx rgba(15, 23, 42, 0.06);
}
.btn-primary {
  border-radius: 999rpx;
  background: var(--theme-accent);
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 600;
  line-height: 80rpx;
}
.btn-primary::after {
  border: 0;
}
</style>
