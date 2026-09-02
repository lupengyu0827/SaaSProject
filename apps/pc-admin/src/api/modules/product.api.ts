/** 商品管理 API：封装分类、品牌、商品、SKU 与库存请求。 */
import type {
  BrandResponse,
  CategoryResponse,
  CreateBrandRequest,
  CreateCategoryRequest,
  CreateProductRequest,
  CreateProductVariantRequest,
  DeleteCatalogItemResponse,
  InventoryBalanceResponse,
  InventoryTransactionResponse,
  ProductListQuery,
  ProductPageResponse,
  ProductResponse,
  ProductVariantResponse,
  RestoreCatalogItemResponse,
  UpdateProductRequest,
  UpdateProductVariantRequest,
  UpdateBrandRequest,
  UpdateCategoryRequest,
  BatchUpdateProductsRequest,
  BatchUpdateProductsResponse,
  CreateProductImageRequest,
  ProductImageResponse,
  SortProductImagesRequest,
} from '@saas/contracts';

import { requestApi } from '../client';

function queryString(query: ProductListQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const value = params.toString();
  return value ? `?${value}` : '';
}

export const productApi = {
  list(query: ProductListQuery = {}): Promise<ProductPageResponse> {
    return requestApi<ProductPageResponse>(`/products${queryString(query)}`);
  },
  get(id: string): Promise<ProductResponse> {
    return requestApi<ProductResponse>(`/products/${id}`);
  },
  create(input: CreateProductRequest): Promise<ProductResponse> {
    return requestApi<ProductResponse>('/products', { method: 'POST', body: input });
  },
  update(id: string, input: UpdateProductRequest): Promise<ProductResponse> {
    return requestApi<ProductResponse>(`/products/${id}`, { method: 'PATCH', body: input });
  },
  batch(input: BatchUpdateProductsRequest): Promise<BatchUpdateProductsResponse> {
    return requestApi<BatchUpdateProductsResponse>('/products/batch', { method: 'POST', body: input });
  },
  addImage(productId: string, input: CreateProductImageRequest): Promise<ProductImageResponse> {
    return requestApi<ProductImageResponse>(`/products/${productId}/images`, { method: 'POST', body: input });
  },
  sortImages(productId: string, input: SortProductImagesRequest): Promise<{ sorted: true }> {
    return requestApi<{ sorted: true }>(`/products/${productId}/images/sort`, { method: 'PATCH', body: input });
  },
  deleteImage(productId: string, imageId: string): Promise<{ deleted: true }> {
    return requestApi<{ deleted: true }>(`/products/${productId}/images/${imageId}`, { method: 'DELETE' });
  },
  categories(includeDeleted = false): Promise<CategoryResponse[]> {
    return requestApi<CategoryResponse[]>(`/categories${includeDeleted ? '?includeDeleted=true' : ''}`);
  },
  createCategory(input: CreateCategoryRequest): Promise<CategoryResponse> {
    return requestApi<CategoryResponse>('/categories', {
      method: 'POST',
      body: input,
    });
  },
  updateCategory(id: string, input: UpdateCategoryRequest): Promise<CategoryResponse> {
    return requestApi<CategoryResponse>(`/categories/${id}`, { method: 'PATCH', body: input });
  },
  deleteCategory(id: string): Promise<DeleteCatalogItemResponse> {
    return requestApi<DeleteCatalogItemResponse>(`/categories/${id}`, { method: 'DELETE' });
  },
  restoreCategory(id: string): Promise<RestoreCatalogItemResponse> {
    return requestApi<RestoreCatalogItemResponse>(`/categories/${id}/restore`, { method: 'POST' });
  },
  brands(includeDeleted = false): Promise<BrandResponse[]> {
    return requestApi<BrandResponse[]>(`/brands${includeDeleted ? '?includeDeleted=true' : ''}`);
  },
  createBrand(input: CreateBrandRequest): Promise<BrandResponse> {
    return requestApi<BrandResponse>('/brands', {
      method: 'POST',
      body: input,
    });
  },
  updateBrand(id: string, input: UpdateBrandRequest): Promise<BrandResponse> {
    return requestApi<BrandResponse>(`/brands/${id}`, { method: 'PATCH', body: input });
  },
  deleteBrand(id: string): Promise<DeleteCatalogItemResponse> {
    return requestApi<DeleteCatalogItemResponse>(`/brands/${id}`, { method: 'DELETE' });
  },
  restoreBrand(id: string): Promise<RestoreCatalogItemResponse> {
    return requestApi<RestoreCatalogItemResponse>(`/brands/${id}/restore`, { method: 'POST' });
  },
  addVariant(id: string, input: CreateProductVariantRequest): Promise<ProductVariantResponse> {
    return requestApi<ProductVariantResponse>(`/products/${id}/variants`, {
      method: 'POST',
      body: input,
    });
  },
  updateVariant(id: string, input: UpdateProductVariantRequest): Promise<ProductVariantResponse> {
    return requestApi<ProductVariantResponse>(`/variants/${id}`, { method: 'PATCH', body: input });
  },
  deleteVariant(id: string): Promise<{ deleted: true }> {
    return requestApi<{ deleted: true }>(`/variants/${id}`, { method: 'DELETE' });
  },
  inventory(variantId: string): Promise<InventoryBalanceResponse> {
    return requestApi<InventoryBalanceResponse>(`/inventory/${variantId}`);
  },
  adjustInventory(variantId: string, quantity: number, reason: string): Promise<InventoryTransactionResponse> {
    return requestApi<InventoryTransactionResponse>('/inventory/adjustment', {
      method: 'POST',
      body: {
        variantId,
        quantity,
        referenceType: 'admin_manual_adjustment',
        referenceId: crypto.randomUUID(),
        reason,
      },
    });
  },
};
