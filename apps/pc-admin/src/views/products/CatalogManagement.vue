<script setup lang="ts">
/** 商品资料管理：集中维护租户级商品分类层级、排序与品牌资料。 */
import type { BrandResponse, CatalogItemStatus, CategoryResponse } from '@saas/contracts';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref, shallowRef } from 'vue';

import { productApi } from '../../api/modules/product.api';
import { useAuthStore } from '../../stores/use-auth-store';

interface CategoryDraft {
  name: string;
  parentId: string;
  sortOrder: number;
  status: CatalogItemStatus;
  version: number;
}

interface BrandDraft {
  name: string;
  logoUrl: string;
  status: CatalogItemStatus;
  version: number;
}

const authStore = useAuthStore();
const categories = shallowRef<CategoryResponse[]>([]);
const brands = shallowRef<BrandResponse[]>([]);
const loading = ref(false);
const submitting = ref(false);
const categoryVisible = ref(false);
const brandVisible = ref(false);
const showDeleted = ref(false);
const editingCategoryId = ref<string>();
const editingBrandId = ref<string>();
const canWrite = computed(() => authStore.hasPermission('products.write'));
const visibleCategories = computed(() =>
  categories.value.filter((item) => showDeleted.value || !item.deletedAt),
);
const visibleBrands = computed(() =>
  brands.value.filter((item) => showDeleted.value || !item.deletedAt),
);
const categoryDraft = reactive<CategoryDraft>({
  name: '',
  parentId: '',
  sortOrder: 0,
  status: 'active',
  version: 0,
});
const brandDraft = reactive<BrandDraft>({
  name: '',
  logoUrl: '',
  status: 'active',
  version: 0,
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    [categories.value, brands.value] = await Promise.all([
      productApi.categories(true),
      productApi.brands(true),
    ]);
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  } finally {
    loading.value = false;
  }
}

function openCategory(category?: CategoryResponse): void {
  editingCategoryId.value = category?.id;
  Object.assign(categoryDraft, {
    name: category?.name ?? '',
    parentId: category?.parentId ?? '',
    sortOrder: category?.sortOrder ?? 0,
    status: category?.status ?? 'active',
    version: category?.version ?? 0,
  });
  categoryVisible.value = true;
}

function openBrand(brand?: BrandResponse): void {
  editingBrandId.value = brand?.id;
  Object.assign(brandDraft, {
    name: brand?.name ?? '',
    logoUrl: brand?.logoUrl ?? '',
    status: brand?.status ?? 'active',
    version: brand?.version ?? 0,
  });
  brandVisible.value = true;
}

async function saveCategory(): Promise<void> {
  if (!categoryDraft.name.trim()) {
    ElMessage.warning('请输入分类名称');
    return;
  }
  submitting.value = true;
  try {
    if (editingCategoryId.value) {
      await productApi.updateCategory(editingCategoryId.value, {
        name: categoryDraft.name,
        parentId: categoryDraft.parentId || null,
        sortOrder: categoryDraft.sortOrder,
        status: categoryDraft.status,
        version: categoryDraft.version,
      });
    } else {
      await productApi.createCategory({
        name: categoryDraft.name,
        parentId: categoryDraft.parentId || undefined,
        sortOrder: categoryDraft.sortOrder,
      });
    }
    ElMessage.success(editingCategoryId.value ? '分类已更新' : '分类已创建');
    categoryVisible.value = false;
    await load();
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  } finally {
    submitting.value = false;
  }
}

async function saveBrand(): Promise<void> {
  if (!brandDraft.name.trim()) {
    ElMessage.warning('请输入品牌名称');
    return;
  }
  submitting.value = true;
  try {
    if (editingBrandId.value) {
      await productApi.updateBrand(editingBrandId.value, {
        name: brandDraft.name,
        logoUrl: brandDraft.logoUrl || null,
        status: brandDraft.status,
        version: brandDraft.version,
      });
    } else {
      await productApi.createBrand({
        name: brandDraft.name,
        logoUrl: brandDraft.logoUrl || undefined,
      });
    }
    ElMessage.success(editingBrandId.value ? '品牌已更新' : '品牌已创建');
    brandVisible.value = false;
    await load();
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  } finally {
    submitting.value = false;
  }
}

async function deleteCategory(category: CategoryResponse): Promise<void> {
  await ElMessageBox.confirm(
    `确认将分类「${category.name}」移入回收站？`,
    '删除分类',
    { type: 'warning' },
  );
  try {
    await productApi.deleteCategory(category.id);
    ElMessage.success('分类已移入回收站');
    await load();
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  }
}

async function restoreCategory(category: CategoryResponse): Promise<void> {
  try {
    await productApi.restoreCategory(category.id);
    ElMessage.success('分类已恢复为停用状态');
    await load();
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  }
}

async function deleteBrand(brand: BrandResponse): Promise<void> {
  await ElMessageBox.confirm(`确认将品牌「${brand.name}」移入回收站？`, '删除品牌', {
    type: 'warning',
  });
  try {
    await productApi.deleteBrand(brand.id);
    ElMessage.success('品牌已移入回收站');
    await load();
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  }
}

async function restoreBrand(brand: BrandResponse): Promise<void> {
  try {
    await productApi.restoreBrand(brand.id);
    ElMessage.success('品牌已恢复为停用状态');
    await load();
  } catch (error: unknown) {
    ElMessage.error(readMessage(error));
  }
}

function parentName(parentId: string | null): string {
  return categories.value.find((item) => item.id === parentId)?.name ?? '一级分类';
}

function readMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请稍后重试';
}

onMounted(() => void load());
</script>

<template>
  <section class="space-y-6" aria-labelledby="catalog-title">
    <div>
      <h1 id="catalog-title" class="text-xl font-medium text-[var(--pc-text-primary)]">商品资料</h1>
      <p class="mt-2 text-sm text-[var(--pc-text-secondary)]">统一维护分类层级、展示顺序与品牌资料。</p>
    </div>

    <el-card shadow="never">
      <el-tabs>
        <el-tab-pane label="商品分类">
          <div class="mb-4 flex items-center justify-between">
            <el-checkbox v-model="showDeleted">显示回收站</el-checkbox>
            <el-button v-if="canWrite" class="whitespace-nowrap" type="primary" @click="openCategory()">新增分类</el-button>
          </div>
          <el-table v-loading="loading" :data="visibleCategories" empty-text="暂无分类">
            <el-table-column prop="name" label="分类名称" min-width="220" />
            <el-table-column label="上级分类" min-width="180"><template #default="{ row }">{{ parentName(row.parentId) }}</template></el-table-column>
            <el-table-column prop="sortOrder" label="排序" width="100" />
            <el-table-column label="引用" width="130"><template #default="{ row }">{{ row.productCount }} 商品 / {{ row.childCount }} 子类</template></el-table-column>
            <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag class="whitespace-nowrap" :type="row.deletedAt ? 'danger' : row.status === 'active' ? 'success' : 'info'">{{ row.deletedAt ? '已删除' : row.status === 'active' ? '启用' : '停用' }}</el-tag></template></el-table-column>
            <el-table-column v-if="canWrite" label="操作" width="160" fixed="right"><template #default="{ row }"><template v-if="row.deletedAt"><el-button link type="primary" @click="restoreCategory(row)">恢复</el-button></template><template v-else><el-button link type="primary" @click="openCategory(row)">编辑</el-button><el-button link type="danger" :disabled="row.productCount > 0 || row.childCount > 0" @click="deleteCategory(row)">删除</el-button></template></template></el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="品牌管理">
          <div class="mb-4 flex items-center justify-between">
            <el-checkbox v-model="showDeleted">显示回收站</el-checkbox>
            <el-button v-if="canWrite" class="whitespace-nowrap" type="primary" @click="openBrand()">新增品牌</el-button>
          </div>
          <el-table v-loading="loading" :data="visibleBrands" empty-text="暂无品牌">
            <el-table-column prop="name" label="品牌名称" min-width="220" />
            <el-table-column label="Logo 地址" min-width="360"><template #default="{ row }"><span class="text-[var(--pc-text-secondary)]">{{ row.logoUrl || '未设置' }}</span></template></el-table-column>
            <el-table-column label="引用商品" width="110" prop="productCount" />
            <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag class="whitespace-nowrap" :type="row.deletedAt ? 'danger' : row.status === 'active' ? 'success' : 'info'">{{ row.deletedAt ? '已删除' : row.status === 'active' ? '启用' : '停用' }}</el-tag></template></el-table-column>
            <el-table-column v-if="canWrite" label="操作" width="160" fixed="right"><template #default="{ row }"><template v-if="row.deletedAt"><el-button link type="primary" @click="restoreBrand(row)">恢复</el-button></template><template v-else><el-button link type="primary" @click="openBrand(row)">编辑</el-button><el-button link type="danger" :disabled="row.productCount > 0" @click="deleteBrand(row)">删除</el-button></template></template></el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="categoryVisible" :title="editingCategoryId ? '编辑分类' : '新增分类'" width="480px" :close-on-click-modal="false">
      <el-form :model="categoryDraft" label-position="right" label-width="100px">
        <el-form-item label="分类名称" required><el-input v-model="categoryDraft.name" maxlength="100" /></el-form-item>
        <el-form-item label="上级分类"><el-select v-model="categoryDraft.parentId" clearable filterable class="w-full"><el-option v-for="item in categories.filter((category) => !category.deletedAt && category.id !== editingCategoryId)" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
        <el-form-item label="展示排序"><el-input-number v-model="categoryDraft.sortOrder" :min="0" :max="9999" /></el-form-item>
        <el-form-item v-if="editingCategoryId" label="状态"><el-radio-group v-model="categoryDraft.status"><el-radio-button value="active">启用</el-radio-button><el-radio-button value="inactive">停用</el-radio-button></el-radio-group></el-form-item>
      </el-form>
      <template #footer><el-button @click="categoryVisible = false">取消</el-button><el-button type="primary" :loading="submitting" @click="saveCategory">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="brandVisible" :title="editingBrandId ? '编辑品牌' : '新增品牌'" width="480px" :close-on-click-modal="false">
      <el-form :model="brandDraft" label-position="right" label-width="100px">
        <el-form-item label="品牌名称" required><el-input v-model="brandDraft.name" maxlength="100" /></el-form-item>
        <el-form-item label="Logo 地址"><el-input v-model="brandDraft.logoUrl" placeholder="https://..." /></el-form-item>
        <el-form-item v-if="editingBrandId" label="状态"><el-radio-group v-model="brandDraft.status"><el-radio-button value="active">启用</el-radio-button><el-radio-button value="inactive">停用</el-radio-button></el-radio-group></el-form-item>
      </el-form>
      <template #footer><el-button @click="brandVisible = false">取消</el-button><el-button type="primary" :loading="submitting" @click="saveBrand">保存</el-button></template>
    </el-dialog>
  </section>
</template>
