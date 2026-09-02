/** 商品列表编排：真实分页、搜索、筛选、排序与基础资料并发加载。 */
import type { BrandResponse, CategoryResponse, ProductListQuery, ProductResponse, ProductStatus } from '@saas/contracts';
import type { Ref, ShallowRef } from 'vue';
import { reactive, ref, shallowRef } from 'vue';
import { productApi } from '../api/modules/product.api';

export interface ProductFilters {
  keyword: string;
  status?: ProductStatus;
  categoryId?: string;
  brandId?: string;
  stockState?: ProductListQuery['stockState'];
  sortBy: NonNullable<ProductListQuery['sortBy']>;
  sortOrder: NonNullable<ProductListQuery['sortOrder']>;
}

interface ProductManagementReturn {
  products: ShallowRef<ProductResponse[]>;
  categories: ShallowRef<CategoryResponse[]>;
  brands: ShallowRef<BrandResponse[]>;
  loading: Ref<boolean>;
  total: Ref<number>;
  page: Ref<number>;
  pageSize: Ref<number>;
  filters: ProductFilters;
  load: () => Promise<void>;
  reset: () => Promise<void>;
}

export function useProductManagement(): ProductManagementReturn {
  const products = shallowRef<ProductResponse[]>([]);
  const categories = shallowRef<CategoryResponse[]>([]);
  const brands = shallowRef<BrandResponse[]>([]);
  const loading = ref(false);
  const total = ref(0);
  const page = ref(1);
  const pageSize = ref(20);
  const filters = reactive<ProductFilters>({ keyword: '', sortBy: 'createdAt', sortOrder: 'desc' });

  async function load(): Promise<void> {
    loading.value = true;
    try {
      const [result, categoryItems, brandItems] = await Promise.all([
        productApi.list({ page: page.value, pageSize: pageSize.value, keyword: filters.keyword.trim() || undefined,
          status: filters.status, categoryId: filters.categoryId, brandId: filters.brandId,
          stockState: filters.stockState, sortBy: filters.sortBy, sortOrder: filters.sortOrder }),
        productApi.categories(), productApi.brands(),
      ]);
      products.value = result.list;
      total.value = result.total;
      categories.value = categoryItems;
      brands.value = brandItems;
    } finally { loading.value = false; }
  }

  async function reset(): Promise<void> {
    Object.assign(filters, { keyword: '', status: undefined, categoryId: undefined, brandId: undefined,
      stockState: undefined, sortBy: 'createdAt', sortOrder: 'desc' });
    page.value = 1;
    await load();
  }

  return { products, categories, brands, loading, total, page, pageSize, filters, load, reset };
}
