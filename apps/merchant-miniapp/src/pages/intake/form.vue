<!-- 商品入库表单：字段对齐奢当家入库规范，提交 POST /commerce/product-intakes。 -->
<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import type {
  BrandModelResponse,
  BrandSeriesResponse,
  IntakeBrandResponse,
  IntakeCategoryResponse,
  IntakeEmployeeResponse,
  ProductAccessory,
  ProductCondition,
  ProductIntakeAction,
  ProductOwnershipType,
  RecyclingTypeResponse,
  WarrantyCardStatus,
} from '@saas/contracts';
import { computed, reactive, ref } from 'vue';

import {
  createProductIntake,
  getBrandModels,
  getBrandSeries,
  getIntakeBrands,
  getIntakeCategories,
  getIntakeEmployees,
  getRecyclingTypes,
} from '../../api/modules/intake.api';
import { confirmMediaUpload, createMediaUploadSession, uploadMediaFile } from '../../api/modules/media.api';
import { useAppTheme } from '../../composables/use-app-theme';

const { themeClass } = useAppTheme();

const OWNERSHIP_OPTIONS: { label: string; value: ProductOwnershipType }[] = [
  { label: '自有商品', value: 'owned' },
  { label: '寄卖商品', value: 'consigned' },
  { label: '质押商品', value: 'pledged' },
  { label: '其他', value: 'other' },
];
const CONDITION_OPTIONS: { label: string; value: ProductCondition }[] = [
  { label: '闲置未使用', value: 'unused' },
  { label: '二手', value: 'preowned' },
];
const WARRANTY_OPTIONS: { label: string; value: WarrantyCardStatus }[] = [
  { label: '有', value: 'present' },
  { label: '无', value: 'absent' },
];
/** 适用人群：单选。 */
const SUITABLE_OPTIONS = ['通用', '男', '女'];
const ACCESSORY_OPTIONS: { label: string; value: ProductAccessory }[] = [
  { label: '无', value: 'none' },
  { label: '包装盒', value: 'box' },
  { label: '发票', value: 'invoice' },
  { label: '收据', value: 'receipt' },
  { label: '保卡', value: 'warranty_card' },
  { label: '身份证', value: 'identity_card' },
  { label: '防尘袋', value: 'dust_bag' },
  { label: '说明书', value: 'manual' },
  { label: '品牌包', value: 'bag' },
];

/** 图片分组（key 对应提交字段，value 为前端展示数组）。 */
type ImageItem = { path: string; assetId: string; uploading: boolean; progress: number; error: boolean };
type ImageGroupKey = 'product' | 'detail' | 'recycling' | 'warranty' | 'remark';

const groupMax: Record<ImageGroupKey, number> = {
  product: 9,
  detail: 50,
  recycling: 9,
  warranty: 9,
  remark: 25,
};
const groupPurpose: Record<ImageGroupKey, 'product' | 'recycling'> = {
  product: 'product',
  detail: 'product',
  recycling: 'recycling',
  warranty: 'product',
  remark: 'product',
};

const form = reactive({
  title: '',
  description: '',
  customTips: '',
  condition: 'unused' as ProductCondition,
  categoryId: '',
  brandId: '',
  seriesId: '',
  modelId: '',
  material: '',
  size: '',
  officialGuidePrice: '',
  productCode: '',
  ownershipType: 'owned' as ProductOwnershipType,
  stockQuantity: '',
  inventoryAgeWarningDays: '90',
  totalCostPrice: '0.00',
  peerPrice: '0.00',
  agentPrice: '0.00',
  salePrice: '0.00',
  appraiserEmployeeId: '',
  recyclingTypeId: '',
  recyclingEmployeeId: '',
  recyclingNotes: '',
  recycledAt: '',
  audience: '',
  warrantyCard: 'absent' as WarrantyCardStatus,
  warrantyCardYear: '',
  uniqueCode: '',
  tagsText: '',
  accessories: [] as ProductAccessory[],
  internalNotes: '',
  detailVideoDuration: 0,
});

const categories = ref<IntakeCategoryResponse[]>([]);
const brands = ref<IntakeBrandResponse[]>([]);
const employees = ref<IntakeEmployeeResponse[]>([]);
const recyclingTypes = ref<RecyclingTypeResponse[]>([]);
const series = ref<BrandSeriesResponse[]>([]);
const models = ref<BrandModelResponse[]>([]);

const productImages = ref<ImageItem[]>([]);
const detailImages = ref<ImageItem[]>([]);
const recyclingImages = ref<ImageItem[]>([]);
const warrantyImages = ref<ImageItem[]>([]);
const remarkImages = ref<ImageItem[]>([]);
const detailVideo = ref<ImageItem | null>(null);
const uploadingCount = ref(0);

const submitting = ref(false);
const action = ref<ProductIntakeAction>('stock_only');
const pageTitle = ref('商品入库');

/** uView 组件定制样式（对齐琥珀金浅色表单视觉）。 */
const inputFieldStyle = { width: '100%', height: '80rpx', background: '#faf8f5', borderRadius: '12rpx', padding: '0 24rpx' };
const inputMonoStyle = { width: '100%', height: '80rpx', background: '#faf8f5', borderRadius: '12rpx', padding: '0 24rpx', fontFamily: 'monospace' };
const textareaFieldStyle = { width: '100%', background: '#faf8f5', borderRadius: '12rpx', padding: '16rpx 24rpx' };
const primaryBtnStyle = { background: '#d4a359', color: '#ffffff', height: '88rpx', borderRadius: '12rpx', fontSize: '28rpx' };
const ghostBtnStyle = { background: '#ffffff', color: '#b45309', border: '1rpx solid rgba(180,83,9,0.24)', height: '88rpx', borderRadius: '12rpx', fontSize: '28rpx' };

const imageGroups: Record<ImageGroupKey, { list: typeof productImages; max: number }> = {
  product: { list: productImages, max: 9 },
  detail: { list: detailImages, max: 50 },
  recycling: { list: recyclingImages, max: 9 },
  warranty: { list: warrantyImages, max: 9 },
  remark: { list: remarkImages, max: 25 },
};

const currentDate = computed(() => {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
});

function pickerLabel(
  options: { label: string; value: string }[],
  value: string,
  placeholder: string,
): string {
  return options.find((option) => option.value === value)?.label ?? placeholder;
}

async function loadOptions(): Promise<void> {
  const [categoryList, brandList, employeeList, typeList] = await Promise.all([
    getIntakeCategories(),
    getIntakeBrands(),
    getIntakeEmployees(),
    getRecyclingTypes(),
  ]);
  categories.value = categoryList;
  brands.value = brandList;
  employees.value = employeeList;
  recyclingTypes.value = typeList;
  if (employeeList.length && !form.appraiserEmployeeId) {
    form.appraiserEmployeeId = employeeList[0]!.id;
  }
}

/** 品牌联动：加载系列与型号，并清空下级与自动带出字段。 */
async function handleBrandChange(): Promise<void> {
  form.seriesId = '';
  form.modelId = '';
  form.material = '';
  form.officialGuidePrice = '';
  series.value = [];
  models.value = [];
  if (!form.brandId) return;
  const [seriesList, modelList] = await Promise.all([
    getBrandSeries(form.brandId),
    getBrandModels(form.brandId),
  ]);
  series.value = seriesList;
  models.value = modelList;
}

/** 选型号自动带出系列、官方指导价与默认材质。 */
function handleModelChange(): void {
  const model = models.value.find((item) => item.id === form.modelId);
  if (!model) return;
  if (model.seriesId) form.seriesId = model.seriesId;
  if (model.officialGuidePrice) form.officialGuidePrice = model.officialGuidePrice;
  if (model.defaultMaterial) form.material = model.defaultMaterial;
}

/** 上传单个本地文件为 MediaAsset，返回 assetId。 */
async function uploadImageToAsset(
  path: string,
  purpose: 'product' | 'recycling',
  onProgress: (progress: number) => void,
): Promise<string> {
  const fileName = path.split('/').pop() ?? `intake-${Date.now()}.jpg`;
  const mimeType = fileName.endsWith('.png')
    ? 'image/png'
    : fileName.endsWith('.webp')
      ? 'image/webp'
      : fileName.endsWith('.mp4') || fileName.endsWith('.MOV') || fileName.endsWith('.mov')
        ? 'video/mp4'
        : 'image/jpeg';
  const size = await new Promise<number>((resolve) => {
    uni.getFileInfo({ filePath: path, success: (res) => resolve(res.size ?? 0), fail: () => resolve(0) });
  });
  const session = await createMediaUploadSession({
    purpose,
    fileName,
    mimeType,
    sizeBytes: size,
  });
  await uploadMediaFile(session, path, onProgress).result;
  const asset = await confirmMediaUpload(session.id);
  return asset.id;
}

function addImageItem(group: ImageGroupKey, path: string): void {
  const entry = imageGroups[group];
  const item: ImageItem = { path, assetId: '', uploading: true, progress: 0, error: false };
  entry.list.value.push(item);
  uploadingCount.value += 1;
  void uploadImageToAsset(path, groupPurpose[group], (progress) => {
    item.progress = progress;
  })
    .then((assetId) => {
      item.assetId = assetId;
      item.uploading = false;
    })
    .catch(() => {
      item.uploading = false;
      item.error = true;
      void uni.showToast({ title: '图片上传失败，点击图片可重试', icon: 'none' });
    })
    .finally(() => {
      uploadingCount.value -= 1;
    });
}

/** 重试上传失败图片。 */
function retryImage(group: ImageGroupKey, index: number): void {
  const entry = imageGroups[group];
  const item = entry.list.value[index];
  if (!item || item.uploading) return;
  item.uploading = true;
  item.error = false;
  item.progress = 0;
  uploadingCount.value += 1;
  void uploadImageToAsset(item.path, groupPurpose[group], (progress) => {
    item.progress = progress;
  })
    .then((assetId) => {
      item.assetId = assetId;
      item.uploading = false;
    })
    .catch(() => {
      item.uploading = false;
      item.error = true;
    })
    .finally(() => {
      uploadingCount.value -= 1;
    });
}

function pickImages(group: ImageGroupKey): void {
  const entry = imageGroups[group];
  const remain = entry.max - entry.list.value.length;
  if (remain <= 0) return;
  uni.chooseImage({
    count: remain,
    sizeType: ['compressed'],
    success: (res) => {
      for (const path of res.tempFilePaths) addImageItem(group, path);
    },
  });
}

function removeImage(group: ImageGroupKey, index: number): void {
  imageGroups[group].list.value.splice(index, 1);
}

/** 选择细节视频（≤60s）。 */
function pickVideo(): void {
  uni.chooseMedia({
    count: 1,
    mediaType: ['video'],
    maxDuration: 60,
    success: (res) => {
      const file = res.tempFiles[0];
      if (!file) return;
      detailVideo.value = { path: file.tempFilePath, assetId: '', uploading: true, progress: 0, error: false };
      form.detailVideoDuration = Math.round(file.duration ?? 0);
      uploadingCount.value += 1;
      void uploadImageToAsset(file.tempFilePath, 'product', (progress) => {
        if (detailVideo.value) detailVideo.value.progress = progress;
      })
        .then((assetId) => {
          if (detailVideo.value) {
            detailVideo.value.assetId = assetId;
            detailVideo.value.uploading = false;
          }
        })
        .catch(() => {
          if (detailVideo.value) detailVideo.value.error = true;
          void uni.showToast({ title: '视频上传失败，点击可重试', icon: 'none' });
        })
        .finally(() => {
          uploadingCount.value -= 1;
        });
    },
  });
}

/** 重试上传细节视频。 */
function retryVideo(): void {
  const video = detailVideo.value;
  if (!video || video.uploading) return;
  video.uploading = true;
  video.error = false;
  video.progress = 0;
  uploadingCount.value += 1;
  void uploadImageToAsset(video.path, 'product', (progress) => {
    if (detailVideo.value) detailVideo.value.progress = progress;
  })
    .then((assetId) => {
      if (detailVideo.value) {
        detailVideo.value.assetId = assetId;
        detailVideo.value.uploading = false;
      }
    })
    .catch(() => {
      if (detailVideo.value) detailVideo.value.error = true;
    })
    .finally(() => {
      uploadingCount.value -= 1;
    });
}

/** 商品附件多选弹层。 */
const showAccessory = ref(false);
const accessorySummary = computed(() =>
  form.accessories
    .map((accessory) => ACCESSORY_OPTIONS.find((option) => option.value === accessory)?.label ?? accessory)
    .join('、'),
);

/* ---------- uView u-picker 统一弹层选择 ---------- */
type PickerKind =
  | 'ownership'
  | 'condition'
  | 'category'
  | 'brand'
  | 'series'
  | 'model'
  | 'appraiser'
  | 'recyclingType'
  | 'recyclingEmployee';
const pickerShow = ref(false);
const pickerKind = ref<PickerKind>('ownership');
const pickerColumns = computed<{ text: string; value: string }[][]>(() => {
  switch (pickerKind.value) {
    case 'ownership':
      return [OWNERSHIP_OPTIONS.map((option) => ({ text: option.label, value: option.value }))];
    case 'condition':
      return [CONDITION_OPTIONS.map((option) => ({ text: option.label, value: option.value }))];
    case 'category':
      return [categories.value.map((item) => ({ text: item.name, value: item.id }))];
    case 'brand':
      return [brands.value.map((item) => ({ text: item.name, value: item.id }))];
    case 'series':
      return [series.value.map((item) => ({ text: item.name, value: item.id }))];
    case 'model':
      return [models.value.map((item) => ({ text: item.name, value: item.id }))];
    case 'appraiser':
      return [employees.value.map((item) => ({ text: item.displayName, value: item.id }))];
    case 'recyclingType':
      return [recyclingTypes.value.map((item) => ({ text: item.name, value: item.id }))];
    case 'recyclingEmployee':
      return [employees.value.map((item) => ({ text: item.displayName, value: item.id }))];
  }
});
function openPicker(kind: PickerKind): void {
  pickerKind.value = kind;
  pickerShow.value = true;
}
function onPickerConfirm(event: { value: Record<string, unknown>[] }): void {
  const value = String(event.value[0]?.value ?? '');
  switch (pickerKind.value) {
    case 'ownership':
      form.ownershipType = (value || 'owned') as ProductOwnershipType;
      break;
    case 'condition':
      form.condition = (value || 'unused') as ProductCondition;
      break;
    case 'category':
      form.categoryId = value;
      break;
    case 'brand':
      form.brandId = value;
      void handleBrandChange();
      break;
    case 'series':
      form.seriesId = value;
      break;
    case 'model':
      form.modelId = value;
      handleModelChange();
      break;
    case 'appraiser':
      form.appraiserEmployeeId = value;
      break;
    case 'recyclingType':
      form.recyclingTypeId = value;
      break;
    case 'recyclingEmployee':
      form.recyclingEmployeeId = value;
      break;
  }
  pickerShow.value = false;
}

function pickDateTime(): void {
  uni.showActionSheet({
    itemList: ['现在', '今天', '昨天'],
    success: (res) => {
      const now = new Date();
      if (res.tapIndex === 1) now.setHours(0, 0, 0, 0);
      if (res.tapIndex === 2) now.setDate(now.getDate() - 1);
      form.recycledAt = now.toISOString();
    },
  });
}

function validate(): string | null {
  if (productImages.value.length === 0) return '请至少上传 1 张商品图片';
  if (!form.title.trim()) return '请填写商品标题';
  if (!form.description.trim()) return '请填写商品描述';
  if (!form.categoryId) return '请选择商品分类';
  if (!form.brandId) return '请选择品牌';
  if (!form.stockQuantity || Number(form.stockQuantity) <= 0) return '请填写库存数量';
  if (!form.appraiserEmployeeId) return '请选择鉴定人员';
  if (!form.recycledAt) return '请选择回收时间';
  return null;
}

async function handleSubmit(targetAction: ProductIntakeAction): Promise<void> {
  if (submitting.value) return;
  const invalid = validate();
  if (invalid) {
    void uni.showToast({ title: invalid, icon: 'none' });
    return;
  }
  if (uploadingCount.value > 0) {
    void uni.showToast({ title: `图片上传中（剩余 ${uploadingCount.value} 张），请稍候`, icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    await createProductIntake({
      idempotencyKey: `intake-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      action: targetAction,
      title: form.title.trim(),
      description: form.description.trim(),
      customTips: form.customTips.trim() || undefined,
      condition: form.condition,
      categoryId: form.categoryId,
      brandId: form.brandId,
      seriesId: form.seriesId || undefined,
      modelId: form.modelId || undefined,
      material: form.material.trim() || undefined,
      size: form.size.trim() || undefined,
      officialGuidePrice: form.officialGuidePrice || undefined,
      productCode: form.productCode.trim() || undefined,
      ownershipType: form.ownershipType,
      stockQuantity: Number(form.stockQuantity),
      inventoryAgeWarningDays: Number(form.inventoryAgeWarningDays) || 90,
      totalCostPrice: form.totalCostPrice || '0.00',
      peerPrice: form.peerPrice || '0.00',
      agentPrice: form.agentPrice || '0.00',
      salePrice: form.salePrice || '0.00',
      appraiserEmployeeId: form.appraiserEmployeeId,
      recyclingTypeId: form.recyclingTypeId || undefined,
      recyclingEmployeeId: form.recyclingEmployeeId || undefined,
      recyclingNotes: form.recyclingNotes.trim() || undefined,
      recycledAt: form.recycledAt,
      audience: form.audience.trim() || undefined,
      warrantyCard: form.warrantyCard,
      warrantyCardYear: form.warrantyCardYear ? Number(form.warrantyCardYear) : undefined,
      uniqueCode: form.uniqueCode.trim() || undefined,
      tags: form.tagsText
        .split(/[,，、]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      accessories: form.accessories.length ? form.accessories : undefined,
      internalNotes: form.internalNotes.trim() || undefined,
      productImageAssetIds: productImages.value.map((item) => item.assetId),
      detailImageAssetIds: detailImages.value.map((item) => item.assetId),
      detailVideoAssetId: detailVideo.value?.assetId || undefined,
      detailVideoDurationSeconds: detailVideo.value ? form.detailVideoDuration : undefined,
      recyclingImageAssetIds: recyclingImages.value.map((item) => item.assetId),
      warrantyImageAssetIds: warrantyImages.value.map((item) => item.assetId),
      remarkImageAssetIds: remarkImages.value.map((item) => item.assetId),
    });
    void uni.showToast({ title: '入库成功', icon: 'success' });
    setTimeout(() => uni.navigateBack(), 800);
  } catch (error: unknown) {
    void uni.showToast({
      title: error instanceof Error ? error.message : '入库失败',
      icon: 'none',
    });
  } finally {
    submitting.value = false;
  }
}

onLoad(async (query) => {
  const params = (query ?? {}) as Record<string, string | undefined>;
  if (params.ownership === 'consigned') form.ownershipType = 'consigned';
  if (params.ownership === 'pledged') form.ownershipType = 'pledged';
  if (params.ownership === 'other') form.ownershipType = 'other';
  if (params.action === 'stock_and_publish') {
    action.value = 'stock_and_publish';
    pageTitle.value = '商品入库（同步上架）';
  }
  const now = new Date();
  form.recycledAt = now.toISOString();
  await loadOptions();
});
</script>

<template>
  <view class="page" :class="themeClass">
    <!-- 1. 商品图片 -->
    <view class="section">
      <view class="section-head">
        <text class="section-title">1. 商品图片</text>
        <text class="section-required">必填 · 最多 9 张</text>
      </view>
      <view class="img-grid">
        <view v-for="(img, index) in productImages" :key="img.path" class="img-item">
          <image class="img-preview" :src="img.path" mode="aspectFill" />
          <view v-if="img.uploading" class="img-mask">
            <text class="img-mask-text">{{ img.progress > 0 && img.progress < 100 ? img.progress + '%' : '上传中' }}</text>
          </view>
          <view v-else-if="img.error" class="img-mask img-mask--error" @click.stop="retryImage('product', index)">
            <text class="img-mask-text">上传失败·点此重试</text>
          </view>
          <view class="img-remove" @click.stop="removeImage('product', index)">×</view>
        </view>
        <view v-if="productImages.length < 9" class="img-add" @click="pickImages('product')">
          <text class="img-add-plus">＋</text>
          <text class="img-add-label">添加图片</text>
          <text class="img-add-tip">{{ productImages.length }}/9</text>
        </view>
      </view>
    </view>

    <!-- 2. 商品资料 -->
    <view class="section">
      <view class="section-head">
        <text class="section-title">2. 商品资料</text>
      </view>
      <view class="field">
        <text class="label">商品标题 <text class="star">*</text></text>
        <view class="field-control">
          <u-input
            v-model="form.title"
            placeholder="例如：黑色小羊皮经典款翻盖包"
            inputAlign="right"
            :border="false"
            :maxlength="200"
            placeholderStyle="color:#9e9a96;"
            :customStyle="inputFieldStyle"
          />
        </view>
      </view>
      <view class="field field--stack">
        <text class="label">商品描述 <text class="star">*</text></text>
        <u-textarea
          v-model="form.description"
          placeholder="描述品相、尺寸与值得关注的细节（最多 250 字）"
          placeholderStyle="color:#9e9a96;"
          :maxlength="250"
          :count="true"
          height="160"
          :customStyle="textareaFieldStyle"
        />
      </view>
      <view class="field">
        <text class="label">自定义贴士</text>
        <view class="field-control">
          <u-input
            v-model="form.customTips"
            placeholder="给顾客的贴心提示（选填）"
            inputAlign="right"
            :border="false"
            :maxlength="100"
            placeholderStyle="color:#9e9a96;"
            :customStyle="inputFieldStyle"
          />
        </view>
      </view>
    </view>

    <!-- 3. 分类与属性 -->
    <view class="section">
      <view class="section-head">
        <text class="section-title">3. 分类与属性</text>
      </view>
      <view class="field">
        <text class="label">商品属性</text>
        <view class="field-control">
          <view class="picker-value" @click="openPicker('ownership')">
            {{ pickerLabel(OWNERSHIP_OPTIONS, form.ownershipType, '请选择商品属性') }}
          </view>
        </view>
      </view>
      <view class="field">
        <text class="label">成色 <text class="star">*</text></text>
        <view class="field-control">
          <view class="picker-value" @click="openPicker('condition')">
            {{ pickerLabel(CONDITION_OPTIONS, form.condition, '请选择成色') }}
          </view>
        </view>
      </view>
      <view class="field">
        <text class="label">商品分类 <text class="star">*</text></text>
        <view class="field-control">
          <view class="picker-value" :class="{ 'picker-value--empty': !form.categoryId }" @click="openPicker('category')">
            {{ categories.find((c) => c.id === form.categoryId)?.name ?? '请选择分类' }}
          </view>
        </view>
      </view>
      <view class="field">
        <text class="label">品牌 <text class="star">*</text></text>
        <view class="field-control">
          <view class="picker-value" :class="{ 'picker-value--empty': !form.brandId }" @click="openPicker('brand')">
            {{ brands.find((b) => b.id === form.brandId)?.name ?? '请选择品牌' }}
          </view>
        </view>
      </view>
      <view class="field">
        <text class="label">系列</text>
        <view class="field-control">
          <view class="picker-value" :class="{ 'picker-value--empty': !form.seriesId }" @click="form.brandId && openPicker('series')">
            {{ series.find((s) => s.id === form.seriesId)?.name ?? (form.brandId ? '请选择系列' : '请先选择品牌') }}
          </view>
        </view>
      </view>
      <view class="field">
        <text class="label">型号</text>
        <view class="field-control">
          <view class="picker-value" :class="{ 'picker-value--empty': !form.modelId }" @click="form.brandId && openPicker('model')">
            {{ models.find((m) => m.id === form.modelId)?.name ?? (form.brandId ? '选择型号自动带出系列' : '请先选择品牌') }}
          </view>
        </view>
      </view>
      <view class="field">
        <text class="label">材质</text>
        <view class="field-control">
          <u-input
            v-model="form.material"
            placeholder="例如：小羊皮、18K 金"
            inputAlign="right"
            :border="false"
            :maxlength="100"
            placeholderStyle="color:#9e9a96;"
            :customStyle="inputFieldStyle"
          />
        </view>
      </view>
      <view class="field">
        <text class="label">尺寸</text>
        <view class="field-control">
          <u-input
            v-model="form.size"
            placeholder="例如：24×16×8cm"
            inputAlign="right"
            :border="false"
            :maxlength="50"
            placeholderStyle="color:#9e9a96;"
            :customStyle="inputFieldStyle"
          />
        </view>
      </view>
      <view class="field">
        <text class="label">官方指导价</text>
        <view class="field-control">
          <u-input
            v-model="form.officialGuidePrice"
            type="digit"
            placeholder="0.00"
            inputAlign="right"
            :border="false"
            placeholderStyle="color:#9e9a96;"
            :customStyle="inputMonoStyle"
          />
        </view>
      </view>
      <view class="field">
        <text class="label">商品货号</text>
        <view class="field-control">
          <u-input
            v-model="form.productCode"
            placeholder="填写后用于唯一标识（选填）"
            inputAlign="right"
            :border="false"
            :maxlength="50"
            placeholderStyle="color:#9e9a96;"
            :customStyle="inputFieldStyle"
          />
        </view>
      </view>
    </view>

    <!-- 4. 价格与库存 -->
    <view class="section">
      <view class="section-head">
        <text class="section-title">4. 价格与库存</text>
      </view>
      <view class="field">
        <text class="label">总成本价</text>
        <view class="field-control">
          <u-input
            v-model="form.totalCostPrice"
            type="digit"
            placeholder="0.00"
            inputAlign="right"
            :border="false"
            placeholderStyle="color:#9e9a96;"
            :customStyle="inputMonoStyle"
          />
        </view>
      </view>
      <view class="field">
        <text class="label">同行价</text>
        <view class="field-control">
          <u-input
            v-model="form.peerPrice"
            type="digit"
            placeholder="0.00"
            inputAlign="right"
            :border="false"
            placeholderStyle="color:#9e9a96;"
            :customStyle="inputMonoStyle"
          />
        </view>
      </view>
      <view class="field">
        <text class="label">代理价</text>
        <view class="field-control">
          <u-input
            v-model="form.agentPrice"
            type="digit"
            placeholder="0.00"
            inputAlign="right"
            :border="false"
            placeholderStyle="color:#9e9a96;"
            :customStyle="inputMonoStyle"
          />
        </view>
      </view>
      <view class="field">
        <text class="label">销售价</text>
        <view class="field-control">
          <u-input
            v-model="form.salePrice"
            type="digit"
            placeholder="0.00"
            inputAlign="right"
            :border="false"
            placeholderStyle="color:#9e9a96;"
            :customStyle="inputMonoStyle"
          />
        </view>
      </view>
      <view class="field">
        <text class="label">库存数量 <text class="star">*</text></text>
        <view class="field-control">
          <u-input
            v-model="form.stockQuantity"
            type="number"
            placeholder="0"
            inputAlign="right"
            :border="false"
            placeholderStyle="color:#9e9a96;"
            :customStyle="inputMonoStyle"
          />
        </view>
      </view>
      <view class="field">
        <text class="label">库存预警（天）</text>
        <view class="field-control">
          <u-input
            v-model="form.inventoryAgeWarningDays"
            type="number"
            placeholder="默认 90 天"
            inputAlign="right"
            :border="false"
            placeholderStyle="color:#9e9a96;"
            :customStyle="inputMonoStyle"
          />
        </view>
      </view>
    </view>

    <!-- 5. 鉴定与回收 -->
    <view class="section">
      <view class="section-head">
        <text class="section-title">5. 鉴定与回收</text>
      </view>
      <view class="field">
        <text class="label">鉴定人员 <text class="star">*</text></text>
        <view class="field-control">
          <view class="picker-value" :class="{ 'picker-value--empty': !form.appraiserEmployeeId }" @click="openPicker('appraiser')">
            {{ employees.find((e) => e.id === form.appraiserEmployeeId)?.displayName ?? '请选择鉴定人员' }}
          </view>
        </view>
      </view>
      <view class="field">
        <text class="label">回收类型</text>
        <view class="field-control">
          <view class="picker-value" :class="{ 'picker-value--empty': !form.recyclingTypeId }" @click="openPicker('recyclingType')">
            {{ recyclingTypes.find((t) => t.id === form.recyclingTypeId)?.name ?? '请选择回收类型' }}
          </view>
        </view>
      </view>
      <view class="field">
        <text class="label">回收人员</text>
        <view class="field-control">
          <view class="picker-value" :class="{ 'picker-value--empty': !form.recyclingEmployeeId }" @click="openPicker('recyclingEmployee')">
            {{ employees.find((e) => e.id === form.recyclingEmployeeId)?.displayName ?? '请选择回收人员' }}
          </view>
        </view>
      </view>
      <view class="field">
        <text class="label">回收时间 <text class="star">*</text></text>
        <view class="picker-value" @click="pickDateTime">
          {{ form.recycledAt ? form.recycledAt.replace('T', ' ').slice(0, 16) : '请选择回收时间' }}
        </view>
      </view>
      <view class="field field--stack">
        <text class="label">回收留底图</text>
        <view class="img-grid">
          <view v-for="(img, index) in recyclingImages" :key="img.path" class="img-item">
            <image class="img-preview" :src="img.path" mode="aspectFill" />
            <view v-if="img.uploading" class="img-mask">
              <text class="img-mask-text">{{ img.progress > 0 && img.progress < 100 ? img.progress + '%' : '上传中' }}</text>
            </view>
            <view v-else-if="img.error" class="img-mask img-mask--error" @click.stop="retryImage('recycling', index)">
              <text class="img-mask-text">上传失败·点此重试</text>
            </view>
            <view class="img-remove" @click.stop="removeImage('recycling', index)">×</view>
          </view>
          <view v-if="recyclingImages.length < 9" class="img-add" @click="pickImages('recycling')">
            <text class="img-add-plus">＋</text>
            <text class="img-add-label">添加图片</text>
            <text class="img-add-tip">{{ recyclingImages.length }}/9</text>
          </view>
        </view>
      </view>
      <view class="field field--stack">
        <text class="label">回收备注</text>
        <u-textarea
          v-model="form.recyclingNotes"
          placeholder="回收过程中的补充说明（最多 250 字）"
          placeholderStyle="color:#9e9a96;"
          :maxlength="250"
          :count="true"
          height="160"
          :customStyle="textareaFieldStyle"
        />
      </view>
    </view>

    <!-- 6. 凭证与标签 -->
    <view class="section">
      <view class="section-head">
        <text class="section-title">6. 凭证与标签</text>
      </view>
      <view class="field">
        <text class="label">适用人群</text>
        <view class="field-control">
          <u-radio-group v-model="form.audience" activeColor="#d4a359" placement="row">
            <u-radio
              v-for="option in SUITABLE_OPTIONS"
              :key="option"
              :name="option"
              :label="option"
              :customStyle="{ marginRight: '32rpx' }"
            />
          </u-radio-group>
        </view>
      </view>
      <view class="field">
        <text class="label">商品保卡</text>
        <view class="field-control">
          <u-radio-group v-model="form.warrantyCard" activeColor="#d4a359" placement="row">
            <u-radio
              v-for="option in WARRANTY_OPTIONS"
              :key="option.value"
              :name="option.value"
              :label="option.label"
              :customStyle="{ marginRight: '32rpx' }"
            />
          </u-radio-group>
        </view>
      </view>
      <view v-if="form.warrantyCard === 'present'" class="field">
        <text class="label">保卡年份</text>
        <view class="field-control">
          <u-input
            v-model="form.warrantyCardYear"
            type="number"
            placeholder="例如：2022"
            inputAlign="right"
            :border="false"
            :maxlength="4"
            placeholderStyle="color:#9e9a96;"
            :customStyle="inputMonoStyle"
          />
        </view>
      </view>
      <view class="field">
        <text class="label">独立编码</text>
        <view class="field-control">
          <u-input
            v-model="form.uniqueCode"
            placeholder="商品唯一编码（选填）"
            inputAlign="right"
            :border="false"
            :maxlength="100"
            placeholderStyle="color:#9e9a96;"
            :customStyle="inputFieldStyle"
          />
        </view>
      </view>
      <view class="field field--stack">
        <text class="label">保卡 / 独立编码照片留底</text>
        <text class="field-hint">仅内部人员可见 · 最多 9 张</text>
        <view class="img-grid">
          <view v-for="(img, index) in warrantyImages" :key="img.path" class="img-item">
            <image class="img-preview" :src="img.path" mode="aspectFill" />
            <view v-if="img.uploading" class="img-mask">
              <text class="img-mask-text">{{ img.progress > 0 && img.progress < 100 ? img.progress + '%' : '上传中' }}</text>
            </view>
            <view v-else-if="img.error" class="img-mask img-mask--error" @click.stop="retryImage('warranty', index)">
              <text class="img-mask-text">上传失败·点此重试</text>
            </view>
            <view class="img-remove" @click.stop="removeImage('warranty', index)">×</view>
          </view>
          <view v-if="warrantyImages.length < 9" class="img-add" @click="pickImages('warranty')">
            <text class="img-add-plus">＋</text>
            <text class="img-add-label">添加图片</text>
            <text class="img-add-tip">{{ warrantyImages.length }}/9</text>
          </view>
        </view>
      </view>
      <view class="field">
        <text class="label">商品标签</text>
        <view class="field-control">
          <u-input
            v-model="form.tagsText"
            placeholder="多个标签用逗号分隔，例如：全新, 热门"
            inputAlign="right"
            :border="false"
            :maxlength="100"
            placeholderStyle="color:#9e9a96;"
            :customStyle="inputFieldStyle"
          />
        </view>
      </view>
      <view class="field">
        <text class="label">商品附件</text>
        <view class="field-control">
          <view class="picker-value" @click="showAccessory = true">
            <text v-if="!form.accessories.length" class="picker-value--empty">请选择附件</text>
            <text v-else class="accessory-summary">{{ accessorySummary }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 7. 细节与内部 -->
    <view class="section">
      <view class="section-head">
        <text class="section-title">7. 细节图与内部信息</text>
      </view>
      <view class="field field--stack">
        <text class="label">细节图</text>
        <text class="field-hint">图片最多 50 张</text>
        <view class="img-grid">
          <view v-for="(img, index) in detailImages" :key="img.path" class="img-item">
            <image class="img-preview" :src="img.path" mode="aspectFill" />
            <view v-if="img.uploading" class="img-mask">
              <text class="img-mask-text">{{ img.progress > 0 && img.progress < 100 ? img.progress + '%' : '上传中' }}</text>
            </view>
            <view v-else-if="img.error" class="img-mask img-mask--error" @click.stop="retryImage('detail', index)">
              <text class="img-mask-text">上传失败·点此重试</text>
            </view>
            <view class="img-remove" @click.stop="removeImage('detail', index)">×</view>
          </view>
          <view v-if="detailImages.length < 50" class="img-add" @click="pickImages('detail')">
            <text class="img-add-plus">＋</text>
            <text class="img-add-label">添加图片</text>
            <text class="img-add-tip">{{ detailImages.length }}/50</text>
          </view>
        </view>
      </view>
      <view class="field field--stack">
        <text class="label">细节视频</text>
        <text class="field-hint">时长不超过 60 秒</text>
        <view v-if="detailVideo" class="video-item">
          <video class="video-preview" :src="detailVideo.path" :controls="false" />
          <view v-if="detailVideo.uploading" class="img-mask">
            <text class="img-mask-text">{{ detailVideo.progress > 0 && detailVideo.progress < 100 ? detailVideo.progress + '%' : '上传中' }}</text>
          </view>
          <view
            v-else-if="detailVideo.error"
            class="img-mask img-mask--error"
            @click.stop="retryVideo"
          >
            <text class="img-mask-text">上传失败·点此重试</text>
          </view>
          <view class="img-remove" @click="detailVideo = null">×</view>
          <text class="video-duration">{{ form.detailVideoDuration }}s</text>
        </view>
        <view v-else class="video-add" @click="pickVideo">
          <text class="img-add-plus">＋</text>
          <text class="img-add-label">添加视频</text>
          <text class="img-add-tip">添加视频</text>
        </view>
      </view>
      <view class="field field--stack">
        <text class="label">内部备注</text>
        <u-textarea
          v-model="form.internalNotes"
          placeholder="仅内部可见的备注（最多 250 字）"
          placeholderStyle="color:#9e9a96;"
          :maxlength="250"
          :count="true"
          height="160"
          :customStyle="textareaFieldStyle"
        />
      </view>
      <view class="field field--stack">
        <text class="label">备注图片</text>
        <text class="field-hint">最多 25 张</text>
        <view class="img-grid">
          <view v-for="(img, index) in remarkImages" :key="img.path" class="img-item">
            <image class="img-preview" :src="img.path" mode="aspectFill" />
            <view v-if="img.uploading" class="img-mask">
              <text class="img-mask-text">{{ img.progress > 0 && img.progress < 100 ? img.progress + '%' : '上传中' }}</text>
            </view>
            <view v-else-if="img.error" class="img-mask img-mask--error" @click.stop="retryImage('remark', index)">
              <text class="img-mask-text">上传失败·点此重试</text>
            </view>
            <view class="img-remove" @click.stop="removeImage('remark', index)">×</view>
          </view>
          <view v-if="remarkImages.length < 25" class="img-add" @click="pickImages('remark')">
            <text class="img-add-plus">＋</text>
            <text class="img-add-label">添加图片</text>
            <text class="img-add-tip">{{ remarkImages.length }}/25</text>
          </view>
        </view>
      </view>
    </view>

    <!-- u-picker 统一下拉弹层 -->
    <u-picker
      :show="pickerShow"
      :columns="pickerColumns"
      keyName="text"
      valueName="value"
      closeOnClickOverlay
      @confirm="onPickerConfirm"
      @cancel="pickerShow = false"
      @close="pickerShow = false"
    />

    <!-- 商品附件多选弹层 -->
    <u-popup :show="showAccessory" mode="bottom" round="16" @close="showAccessory = false">
      <view class="accessory-panel">
        <view class="accessory-sheet-head">
          <text class="accessory-sheet-title">选择商品附件</text>
          <text class="accessory-sheet-done" @click="showAccessory = false">完成</text>
        </view>
        <u-checkbox-group v-model="form.accessories" activeColor="#d4a359" placement="column">
          <u-checkbox
            v-for="option in ACCESSORY_OPTIONS"
            :key="option.value"
            :name="option.value"
            :label="option.label"
            shape="circle"
            :customStyle="{ marginBottom: '28rpx' }"
          />
        </u-checkbox-group>
      </view>
    </u-popup>

    <!-- 提交栏 -->
    <view class="submit-bar">
      <u-button
        text="仅入库"
        shape="square"
        :customStyle="ghostBtnStyle"
        :loading="submitting"
        :disabled="submitting"
        @click="handleSubmit('stock_only')"
      />
      <u-button
        text="入库并上架"
        shape="square"
        :customStyle="primaryBtnStyle"
        :loading="submitting"
        :disabled="submitting"
        @click="handleSubmit('stock_and_publish')"
      />
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '../../styles/tokens.scss';
.page {
  min-height: 100vh;
  padding: 24rpx 32rpx calc(160rpx + env(safe-area-inset-bottom));
  color: var(--theme-text);
  background: var(--theme-bg);
}
.section {
  margin-bottom: 24rpx;
  padding: 28rpx;
  border: 1rpx solid var(--theme-border);
  border-radius: 16rpx;
  background: var(--theme-surface);
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 22rpx;
  margin-bottom: 12rpx;
  border-bottom: 1rpx solid var(--theme-border-soft);
}
.section-title {
  position: relative;
  padding-left: 18rpx;
  color: var(--theme-text);
  font-family: $font-display;
  font-size: 30rpx;
  font-weight: 700;
  line-height: 1.3;
}
.section-title::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  width: 6rpx;
  height: 26rpx;
  transform: translateY(-50%);
  border-radius: 3rpx;
  background: var(--theme-accent);
}
.section-required {
  color: var(--theme-text-muted);
  font-size: 22rpx;
}

/* 字段行：紧凑、分隔线、左右对齐 */
.field {
  display: flex;
  align-items: center;
  gap: 24rpx;
  min-height: 96rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid var(--theme-border-soft);
}
.field:last-child {
  border-bottom: none;
}
.field > .label {
  width: 180rpx;
  flex-shrink: 0;
  color: var(--theme-text);
  font-size: 26rpx;
  font-weight: 500;
}
.field > .field-control,
.field > .picker-value {
  flex: 1;
  min-width: 0;
  width: 100%;
}
/* uView 组件宽度统一由 customStyle 的 width:100% 控制（小程序 WXSS 不支持通配符选择器） */
/* 图片区与文本域保持上下堆叠布局 */
.field--stack {
  display: block;
  min-height: auto;
  padding-top: 20rpx;
  padding-bottom: 20rpx;
}
.field--stack > .label {
  width: auto;
  margin-bottom: 28rpx;
}
.star {
  color: var(--theme-accent);
  font-weight: 700;
}
.field-hint {
  display: block;
  margin: -6rpx 0 16rpx;
  color: var(--theme-text-muted);
  font-size: 22rpx;
}

/* 下拉触发行（u-picker 弹层） */
.picker-value {
  display: block;
  min-height: 80rpx;
  box-sizing: border-box;
  padding: 0 24rpx;
  border: 1rpx solid transparent;
  border-radius: 12rpx;
  background: var(--theme-bg);
  color: var(--theme-text);
  font-size: 26rpx;
  line-height: 80rpx;
  text-align: right;
}
.picker-value::after {
  content: '›';
  margin-left: 8rpx;
  color: var(--theme-accent);
  font-size: 34rpx;
  line-height: 1;
}
.picker-value--empty {
  color: var(--theme-text-muted);
}
.accessory-summary {
  overflow: hidden;
  color: var(--theme-text);
  font-size: 26rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 附件多选弹层（u-popup 内容） */
.accessory-panel {
  padding: 28rpx 32rpx calc(28rpx + env(safe-area-inset-bottom));
}
.accessory-sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}
.accessory-sheet-title {
  color: var(--theme-text);
  font-family: $font-display;
  font-size: 32rpx;
  font-weight: 700;
}
.accessory-sheet-done {
  padding: 12rpx 28rpx;
  border-radius: 12rpx;
  background: var(--theme-accent);
  color: #fff;
  font-size: 26rpx;
  font-weight: 600;
}

/* 图片网格 */
.img-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.img-item,
.img-add {
  position: relative;
  width: 176rpx;
  height: 176rpx;
  overflow: hidden;
  border-radius: 12rpx;
}
.img-preview {
  width: 100%;
  height: 100%;
  background: var(--theme-accent-soft);
}
.img-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}
.img-mask--error {
  background: rgba(190, 18, 60, 0.72);
}
.img-mask-text {
  padding: 0 8rpx;
  color: #fff;
  font-size: 22rpx;
  text-align: center;
}
.img-remove {
  position: absolute;
  top: 6rpx;
  right: 6rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 28rpx;
  line-height: 1;
}
.img-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1rpx dashed rgba(180, 83, 9, 0.4);
  background: var(--theme-accent-soft);
}
.img-add-plus {
  color: var(--theme-accent);
  font-size: 56rpx;
  line-height: 1;
}
.img-add-label {
  margin-top: 10rpx;
  color: #b45309;
  font-size: 22rpx;
  font-weight: 500;
}
.img-add-tip {
  margin-top: 4rpx;
  color: var(--theme-text-muted);
  font-size: 20rpx;
}
.video-item {
  position: relative;
  width: 240rpx;
  height: 320rpx;
  overflow: hidden;
  border-radius: 12rpx;
}
.video-preview {
  width: 100%;
  height: 100%;
}
.video-duration {
  position: absolute;
  right: 8rpx;
  bottom: 8rpx;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 20rpx;
}
.video-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 240rpx;
  height: 200rpx;
  border: 1rpx dashed rgba(180, 83, 9, 0.4);
  border-radius: 12rpx;
  background: var(--theme-accent-soft);
}

/* 提交栏（u-button 需要撑满一半） */
.submit-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid var(--theme-border);
  background: var(--theme-surface, #ffffff);
  box-shadow: 0 -8rpx 24rpx rgba(28, 25, 23, 0.04);
}
.submit-bar > u-button,
.submit-bar > .u-button {
  flex: 1;
}
</style>
