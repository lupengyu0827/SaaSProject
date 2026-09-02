<script setup lang="ts">
/** 商品管理工作台：商品检索、建档、编辑以及 SKU/库存查看。 */
import type {
  InventoryBalanceResponse,
  ProductResponse,
  ProductStatus,
  ProductVariantResponse,
} from '@saas/contracts';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref, shallowRef } from 'vue';

import { productApi } from '../../api/modules/product.api';
import { useProductManagement } from '../../composables/use-product-management';
import { useAuthStore } from '../../stores/use-auth-store';

interface ProductDraft {
  code: string;
  name: string;
  description: string;
  categoryId: string;
  brandId: string;
  conditionGrade: 'new' | 'excellent' | 'good' | 'fair';
  authenticityStatus: 'pending' | 'authenticated' | 'rejected';
  serialNumber: string;
  material: string;
  color: string;
  year?: number;
  variants: VariantDraft[];
}

interface VariantDraft { sku: string; specName: string; specValue: string; price: string; costPrice: string; weightG: string; initialStock: number; }

interface ProductEditDraft {
  name: string;
  description: string;
  categoryId: string;
  brandId: string;
  status: ProductStatus;
}

const authStore = useAuthStore();
const { products, categories, brands, loading, total, page, pageSize, filters, load, reset } =
  useProductManagement();
const formRef = ref<FormInstance>();
const createVisible = ref(false);
const detailVisible = ref(false);
const submitting = ref(false);
const selectedProduct = shallowRef<ProductResponse | null>(null);
const inventoryMap = shallowRef<Record<string, InventoryBalanceResponse>>({});
const selectedRows = shallowRef<ProductResponse[]>([]);
const draft = reactive<ProductDraft>(emptyDraft());
const editDraft = reactive<ProductEditDraft>({
  name: '',
  description: '',
  categoryId: '',
  brandId: '',
  status: 'draft',
});
const canWrite = computed(() => authStore.hasPermission('products.write'));
const rules: FormRules<ProductDraft> = {
  code: [{ required: true, message: '请输入商品编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
};
const statusOptions: Array<{ label: string; value?: ProductStatus }> = [
  { label: '全部' },
  { label: '草稿', value: 'draft' },
  { label: '在售', value: 'active' },
  { label: '已归档', value: 'archived' },
];
const statusLabels: Record<ProductStatus, string> = {
  draft: '草稿',
  active: '在售',
  archived: '已归档',
};

function emptyDraft(): ProductDraft {
  return {
    code: '',
    name: '',
    description: '',
    categoryId: '',
    brandId: '',
    conditionGrade: 'good', authenticityStatus: 'pending', serialNumber: '', material: '', color: '',
    variants: [emptyVariant()],
  };
}

function emptyVariant(): VariantDraft { return { sku: '', specName: '', specValue: '', price: '', costPrice: '', weightG: '', initialStock: 0 }; }

function handleCreate(): void {
  Object.assign(draft, emptyDraft());
  createVisible.value = true;
}

async function handleSubmitCreate(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  if (!draft.variants.length || draft.variants.some((item) => !item.sku.trim() || !/^\d{1,10}(\.\d{1,2})?$/.test(item.price))) {
    ElMessage.warning('请至少填写一个完整 SKU，并检查销售价'); return;
  }
  if (new Set(draft.variants.map(({ sku }) => sku.trim())).size !== draft.variants.length) { ElMessage.warning('SKU 编码不能重复'); return; }
  submitting.value = true;
  try {
    await productApi.create({
      code: draft.code,
      name: draft.name,
      description: draft.description || undefined,
      categoryId: draft.categoryId || undefined,
      brandId: draft.brandId || undefined,
      attributes: { conditionGrade: draft.conditionGrade, authenticityStatus: draft.authenticityStatus,
        serialNumber: draft.serialNumber || undefined, material: draft.material || undefined,
        color: draft.color || undefined, year: draft.year },
      variants: draft.variants.map((item) => ({ sku: item.sku, price: item.price,
        costPrice: item.costPrice || undefined, weightG: item.weightG || undefined,
        initialStock: item.initialStock, specs: item.specName && item.specValue ? { [item.specName]: item.specValue } : {} })),
    });
    ElMessage.success('商品创建成功');
    createVisible.value = false;
    await handleLoad();
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  } finally {
    submitting.value = false;
  }
}

async function handleCreateCategory(target: 'create' | 'edit'): Promise<void> {
  const result = await ElMessageBox.prompt('请输入分类名称', '新增商品分类', {
    inputPattern: /\S+/,
    inputErrorMessage: '分类名称不能为空',
  });
  try {
    const category = await productApi.createCategory({ name: result.value });
    categories.value = [...categories.value, category];
    if (target === 'create') draft.categoryId = category.id;
    else editDraft.categoryId = category.id;
    ElMessage.success('分类已创建并选中');
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  }
}

async function handleCreateBrand(target: 'create' | 'edit'): Promise<void> {
  const result = await ElMessageBox.prompt('请输入品牌名称', '新增商品品牌', {
    inputPattern: /\S+/,
    inputErrorMessage: '品牌名称不能为空',
  });
  try {
    const brand = await productApi.createBrand({ name: result.value });
    brands.value = [...brands.value, brand];
    if (target === 'create') draft.brandId = brand.id;
    else editDraft.brandId = brand.id;
    ElMessage.success('品牌已创建并选中');
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  }
}

async function handleOpen(row: ProductResponse): Promise<void> {
  detailVisible.value = true;
  try {
    const product = await productApi.get(row.id);
    selectedProduct.value = product;
    Object.assign(editDraft, {
      name: product.name,
      description: product.description ?? '',
      categoryId: product.categoryId ?? '',
      brandId: product.brandId ?? '',
      status: product.status,
    });
    const balances = await Promise.all(
      product.variants.map(async (variant) => [variant.id, await productApi.inventory(variant.id)] as const),
    );
    inventoryMap.value = Object.fromEntries(balances);
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  }
}

async function handleSave(): Promise<void> {
  const product = selectedProduct.value;
  if (!product) return;
  submitting.value = true;
  try {
    selectedProduct.value = await productApi.update(product.id, {
      name: editDraft.name,
      description: editDraft.description,
      categoryId: editDraft.categoryId || null,
      brandId: editDraft.brandId || null,
      status: editDraft.status,
      version: product.version,
    });
    ElMessage.success('商品信息已保存');
    await handleLoad();
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  } finally {
    submitting.value = false;
  }
}

async function handleEditVariant(variant: ProductVariantResponse): Promise<void> {
  const result = await ElMessageBox.prompt('请输入新的销售价', `编辑 SKU · ${variant.sku}`, {
    inputValue: variant.price,
    inputPattern: /^\d{1,10}(\.\d{1,2})?$/,
    inputErrorMessage: '请输入正确金额',
  });
  try {
    await productApi.updateVariant(variant.id, { price: result.value, version: variant.version });
    ElMessage.success('SKU 价格已更新');
    if (selectedProduct.value) await handleOpen(selectedProduct.value);
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  }
}

async function handleAddVariant(): Promise<void> {
  const product = selectedProduct.value;
  if (!product) return;
  const sku = await ElMessageBox.prompt('请输入 SKU 编码', '新增 SKU', {
    inputPattern: /\S+/,
    inputErrorMessage: 'SKU 编码不能为空',
  });
  const price = await ElMessageBox.prompt('请输入销售价', '新增 SKU', {
    inputPattern: /^\d{1,10}(\.\d{1,2})?$/,
    inputErrorMessage: '请输入正确金额',
  });
  try {
    await productApi.addVariant(product.id, { sku: sku.value, price: price.value });
    ElMessage.success('SKU 已新增');
    await handleOpen(product);
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  }
}

async function handleAdjustInventory(variant: ProductVariantResponse): Promise<void> {
  const result = await ElMessageBox.prompt('请输入库存调整量，可填写负数', `调整库存 · ${variant.sku}`, {
    inputPattern: /^-?[1-9]\d*$/,
    inputErrorMessage: '请输入非零整数',
  });
  try {
    const transaction = await productApi.adjustInventory(
      variant.id,
      Number(result.value),
      '管理后台手工调整',
    );
    inventoryMap.value = { ...inventoryMap.value, [variant.id]: transaction.balance };
    ElMessage.success('库存已调整');
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  }
}

async function handleDeleteVariant(variant: ProductVariantResponse): Promise<void> {
  await ElMessageBox.confirm(`确认删除 SKU「${variant.sku}」？`, '删除 SKU', { type: 'warning' });
  try {
    await productApi.deleteVariant(variant.id);
    ElMessage.success('SKU 已删除');
    if (selectedProduct.value) await handleOpen(selectedProduct.value);
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  }
}

async function handleAddImage(): Promise<void> {
  const product = selectedProduct.value; if (!product) return;
  const result = await ElMessageBox.prompt('请输入已上传到对象存储的图片 URL', '添加商品图片', { inputPattern: /^(https?:\/\/|\/)/, inputErrorMessage: '请输入有效图片地址' });
  try { await productApi.addImage(product.id, { url: result.value, sizeBytes: 1, mimeType: 'image/jpeg' }); await handleOpen(product); ElMessage.success('图片已添加'); }
  catch (error: unknown) { ElMessage.error(readMessage(error)); }
}

async function handleDeleteImage(imageId: string): Promise<void> {
  const product = selectedProduct.value; if (!product) return;
  await ElMessageBox.confirm('确认移除这张图片？', '移除图片', { type: 'warning' });
  try { await productApi.deleteImage(product.id, imageId); await handleOpen(product); ElMessage.success('图片已移除'); }
  catch (error: unknown) { ElMessage.error(readMessage(error)); }
}

async function handlePrimaryImage(imageId: string): Promise<void> {
  const product = selectedProduct.value; if (!product) return;
  await productApi.sortImages(product.id, { imageIds: product.images.map(({ id }) => id), primaryImageId: imageId });
  await handleOpen(product); ElMessage.success('主图已更新');
}

async function handleBatch(action: 'activate' | 'archive' | 'soft_delete'): Promise<void> {
  if (!selectedRows.value.length) return;
  const label = action === 'activate' ? '上架' : action === 'archive' ? '归档' : '删除';
  await ElMessageBox.confirm(`确认批量${label}选中的 ${selectedRows.value.length} 个商品？`, '批量操作', { type: 'warning' });
  try {
    await productApi.batch({ ids: selectedRows.value.map(({ id }) => id), action });
    ElMessage.success(`批量${label}成功`);
    selectedRows.value = [];
    await handleLoad();
  } catch (error: unknown) { ElMessage.error(readMessage(error)); }
}

function handleSelectionChange(rows: ProductResponse[]): void { selectedRows.value = rows; }

function handleAddDraftVariant(): void { draft.variants.push(emptyVariant()); }
function handleRemoveDraftVariant(index: number): void { if (draft.variants.length > 1) draft.variants.splice(index, 1); }

async function handlePageChange(): Promise<void> { await handleLoad(); }

async function handleLoad(): Promise<void> {
  try {
    await load();
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  }
}

function readMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请稍后重试';
}

function categoryName(id: string | null): string {
  return categories.value.find((item) => item.id === id)?.name ?? '未分类';
}

function brandName(id: string | null): string {
  return brands.value.find((item) => item.id === id)?.name ?? '未设置';
}

function priceRange(product: ProductResponse): string {
  const prices = product.variants.map((item) => Number(item.price));
  if (prices.length === 0) return '--';
  const minimum = Math.min(...prices).toFixed(2);
  const maximum = Math.max(...prices).toFixed(2);
  return minimum === maximum ? `¥ ${minimum}` : `¥ ${minimum} - ${maximum}`;
}

function statusLabel(product: ProductResponse): string {
  return statusLabels[product.status];
}

function statusType(product: ProductResponse): 'success' | 'warning' | 'info' {
  if (product.status === 'active') return 'success';
  if (product.status === 'draft') return 'warning';
  return 'info';
}

onMounted(() => void handleLoad());
</script>

<template>
  <section class="space-y-6" aria-labelledby="products-title">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 id="products-title" class="text-xl font-medium text-[var(--pc-text-primary)]">商品管理</h1>
        <p class="mt-2 text-sm text-[var(--pc-text-secondary)]">维护商品档案、销售状态、SKU 与实时库存。</p>
      </div>
      <el-button v-if="canWrite" class="whitespace-nowrap" type="primary" @click="handleCreate">新增商品</el-button>
    </div>

    <el-card shadow="never">
      <div class="flex flex-wrap items-center gap-3">
        <el-input v-model="filters.keyword" class="w-72" clearable placeholder="搜索商品名称、编码或 SKU" @keyup.enter="page = 1; handleLoad()" />
        <el-select v-model="filters.status" class="w-36" clearable placeholder="全部状态">
          <el-option v-for="option in statusOptions.slice(1)" :key="option.label" :label="option.label" :value="option.value" />
        </el-select>
        <el-select v-model="filters.categoryId" class="w-40" clearable filterable placeholder="全部分类"><el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" /></el-select>
        <el-select v-model="filters.brandId" class="w-40" clearable filterable placeholder="全部品牌"><el-option v-for="item in brands" :key="item.id" :label="item.name" :value="item.id" /></el-select>
        <el-select v-model="filters.stockState" class="w-36" clearable placeholder="库存状态"><el-option label="库存充足" value="in_stock" /><el-option label="低库存" value="low_stock" /><el-option label="已售罄" value="out_of_stock" /></el-select>
        <el-button type="primary" @click="page = 1; handleLoad()">搜索</el-button>
        <el-button @click="reset">重置</el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <div v-if="canWrite && selectedRows.length" class="mb-4 flex items-center gap-2"><span class="text-sm text-[var(--pc-text-secondary)]">已选 {{ selectedRows.length }} 项</span><el-button @click="handleBatch('activate')">批量上架</el-button><el-button @click="handleBatch('archive')">批量归档</el-button><el-button type="danger" plain @click="handleBatch('soft_delete')">批量删除</el-button></div>
      <el-table v-loading="loading" :data="products" empty-text="暂无商品，点击右上角新增商品" @row-click="handleOpen" @selection-change="handleSelectionChange">
        <el-table-column v-if="canWrite" type="selection" width="48" @click.stop />
        <el-table-column label="商品" min-width="260">
          <template #default="{ row }">
            <p class="font-medium text-[var(--pc-text-primary)]">{{ row.name }}</p>
            <p class="mt-1 font-mono text-xs text-[var(--pc-text-secondary)]">{{ row.code }}</p>
          </template>
        </el-table-column>
        <el-table-column label="分类 / 品牌" min-width="180">
          <template #default="{ row }">{{ categoryName(row.categoryId) }} / {{ brandName(row.brandId) }}</template>
        </el-table-column>
        <el-table-column label="销售价" min-width="180">
          <template #default="{ row }"><span class="font-mono">{{ priceRange(row) }}</span></template>
        </el-table-column>
        <el-table-column label="SKU" width="90">
          <template #default="{ row }">{{ row.variants.length }}</template>
        </el-table-column>
        <el-table-column label="库存" width="110"><template #default="{ row }"><span :class="row.availableStockQty <= 5 ? 'text-[var(--pc-danger)]' : 'text-[var(--pc-text-primary)]'">{{ row.availableStockQty }}</span></template></el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag class="whitespace-nowrap" :type="statusType(row)">{{ statusLabel(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="180">
          <template #default="{ row }">{{ new Date(row.updatedAt).toLocaleString('zh-CN', { hour12: false }) }}</template>
        </el-table-column>
      </el-table>
      <div class="mt-4 flex justify-end"><el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next, jumper" @size-change="handlePageChange" @current-change="handlePageChange" /></div>
    </el-card>

    <el-dialog v-model="createVisible" title="新增商品" width="600px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="draft" :rules="rules" label-position="right" label-width="100px">
        <el-form-item label="商品编码" prop="code"><el-input v-model="draft.code" /></el-form-item>
        <el-form-item label="商品名称" prop="name"><el-input v-model="draft.name" /></el-form-item>
        <el-form-item label="商品分类"><div class="flex w-full gap-2"><el-select v-model="draft.categoryId" clearable filterable class="flex-1" empty-text="暂无分类，请先新增"><el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" /></el-select><el-button class="whitespace-nowrap" @click="handleCreateCategory('create')">新增分类</el-button></div></el-form-item>
        <el-form-item label="品牌"><div class="flex w-full gap-2"><el-select v-model="draft.brandId" clearable filterable class="flex-1" empty-text="暂无品牌，请先新增"><el-option v-for="item in brands" :key="item.id" :label="item.name" :value="item.id" /></el-select><el-button class="whitespace-nowrap" @click="handleCreateBrand('create')">新增品牌</el-button></div></el-form-item>
        <el-form-item label="商品描述"><el-input v-model="draft.description" type="textarea" :rows="3" /></el-form-item>
        <el-divider>奢品属性</el-divider>
        <el-form-item label="成色"><el-select v-model="draft.conditionGrade" class="w-full"><el-option label="全新" value="new" /><el-option label="极佳" value="excellent" /><el-option label="良好" value="good" /><el-option label="一般" value="fair" /></el-select></el-form-item>
        <el-form-item label="鉴定状态"><el-select v-model="draft.authenticityStatus" class="w-full"><el-option label="待鉴定" value="pending" /><el-option label="已鉴定" value="authenticated" /><el-option label="未通过" value="rejected" /></el-select></el-form-item>
        <el-form-item label="序列号"><el-input v-model="draft.serialNumber" maxlength="100" /></el-form-item>
        <el-form-item label="材质 / 颜色"><div class="flex w-full gap-2"><el-input v-model="draft.material" placeholder="材质" /><el-input v-model="draft.color" placeholder="颜色" /></div></el-form-item>
        <el-form-item label="年份"><el-input-number v-model="draft.year" :min="1800" :max="2100" controls-position="right" /></el-form-item>
        <el-divider>SKU / 规格 / 价格 / 库存</el-divider>
        <div v-for="(variant, index) in draft.variants" :key="index" class="mb-4 border-b border-[var(--pc-border)] pb-4">
          <div class="mb-3 flex items-center justify-between"><span class="text-sm font-medium text-[var(--pc-text-primary)]">SKU {{ index + 1 }}</span><el-button v-if="draft.variants.length > 1" link type="danger" @click="handleRemoveDraftVariant(index)">移除</el-button></div>
          <el-form-item label="SKU 编码" required><el-input v-model="variant.sku" /></el-form-item>
          <el-form-item label="规格"><div class="flex w-full gap-2"><el-input v-model="variant.specName" placeholder="规格名，如尺寸" /><el-input v-model="variant.specValue" placeholder="规格值，如 M" /></div></el-form-item>
          <el-form-item label="销售 / 成本" required><div class="flex w-full gap-2"><el-input v-model="variant.price" prefix="¥" placeholder="销售价" /><el-input v-model="variant.costPrice" prefix="¥" placeholder="成本价" /></div></el-form-item>
          <el-form-item label="重量 / 库存"><div class="flex w-full gap-2"><el-input v-model="variant.weightG" suffix="g" placeholder="重量" /><el-input-number v-model="variant.initialStock" :min="0" :max="999999" controls-position="right" /></div></el-form-item>
        </div>
        <div class="text-right"><el-button class="whitespace-nowrap" @click="handleAddDraftVariant">新增 SKU</el-button></div>
      </el-form>
      <template #footer><el-button @click="createVisible = false">取消</el-button><el-button type="primary" :loading="submitting" @click="handleSubmitCreate">创建商品</el-button></template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="商品详情" size="720px">
      <template v-if="selectedProduct">
        <el-form :model="editDraft" label-position="right" label-width="100px">
          <el-form-item label="商品编码"><el-input :model-value="selectedProduct.code" disabled /></el-form-item>
          <el-form-item label="商品名称"><el-input v-model="editDraft.name" :disabled="!canWrite" /></el-form-item>
          <el-form-item label="分类"><div class="flex w-full gap-2"><el-select v-model="editDraft.categoryId" clearable filterable class="flex-1" :disabled="!canWrite" empty-text="暂无分类，请先新增"><el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" /></el-select><el-button v-if="canWrite" class="whitespace-nowrap" @click="handleCreateCategory('edit')">新增分类</el-button></div></el-form-item>
          <el-form-item label="品牌"><div class="flex w-full gap-2"><el-select v-model="editDraft.brandId" clearable filterable class="flex-1" :disabled="!canWrite" empty-text="暂无品牌，请先新增"><el-option v-for="item in brands" :key="item.id" :label="item.name" :value="item.id" /></el-select><el-button v-if="canWrite" class="whitespace-nowrap" @click="handleCreateBrand('edit')">新增品牌</el-button></div></el-form-item>
          <el-form-item label="状态"><el-select v-model="editDraft.status" class="w-full" :disabled="!canWrite"><el-option v-for="option in statusOptions.slice(1)" :key="option.label" :label="option.label" :value="option.value" /></el-select></el-form-item>
          <el-form-item label="描述"><el-input v-model="editDraft.description" type="textarea" :rows="3" :disabled="!canWrite" /></el-form-item>
        </el-form>
        <div v-if="canWrite" class="mb-6 text-right"><el-button type="primary" :loading="submitting" @click="handleSave">保存商品</el-button></div>
        <div class="mb-4 flex items-center justify-between"><h3 class="text-base font-medium text-[var(--pc-text-primary)]">商品图片</h3><el-button v-if="canWrite" @click="handleAddImage">添加图片</el-button></div>
        <el-empty v-if="!selectedProduct.images.length" :image-size="64" description="暂无商品图片" />
        <div v-else class="mb-6 grid grid-cols-4 gap-4"><div v-for="image in selectedProduct.images" :key="image.id" class="relative"><el-image class="h-28 w-full rounded object-cover" :src="image.url" fit="cover" /><el-tag v-if="image.isPrimary" class="absolute left-1 top-1 whitespace-nowrap" type="success">主图</el-tag><div v-if="canWrite" class="mt-1 flex justify-between"><el-button link type="primary" @click="handlePrimaryImage(image.id)">设主图</el-button><el-button link type="danger" @click="handleDeleteImage(image.id)">移除</el-button></div></div></div>
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-base font-medium text-[var(--pc-text-primary)]">SKU 与库存</h3>
          <el-button v-if="canWrite" class="whitespace-nowrap" @click="handleAddVariant">新增 SKU</el-button>
        </div>
        <el-table :data="selectedProduct.variants">
          <el-table-column prop="sku" label="SKU" min-width="160" />
          <el-table-column label="销售价" width="120"><template #default="{ row }">¥ {{ row.price }}</template></el-table-column>
          <el-table-column label="可用 / 在库" width="120"><template #default="{ row }">{{ inventoryMap[row.id]?.available ?? 0 }} / {{ inventoryMap[row.id]?.onHand ?? 0 }}</template></el-table-column>
          <el-table-column v-if="canWrite" label="操作" width="220" fixed="right"><template #default="{ row }"><el-button link type="primary" @click.stop="handleEditVariant(row)">改价</el-button><el-button link type="primary" @click.stop="handleAdjustInventory(row)">调库存</el-button><el-button link type="danger" @click.stop="handleDeleteVariant(row)">删除</el-button></template></el-table-column>
        </el-table>
      </template>
    </el-drawer>
  </section>
</template>
