export type ProductStatus = 'draft' | 'active' | 'archived';

export interface CreateCategoryRequest {
  name: string;
  parentId?: string;
  sortOrder?: number;
}

export interface CreateBrandRequest {
  name: string;
  logoUrl?: string;
}

export interface CreateProductVariantRequest {
  sku: string;
  specs?: Record<string, unknown>;
  price: string;
  costPrice?: string;
  weightG?: string;
}

export interface UpdateProductVariantRequest {
  specs?: Record<string, unknown>;
  price?: string;
  costPrice?: string;
  weightG?: string | null;
}

export interface CreateProductRequest {
  code: string;
  name: string;
  description?: string;
  categoryId?: string;
  brandId?: string;
  attributes?: Record<string, unknown>;
  seoSlug?: string;
  variants: CreateProductVariantRequest[];
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  categoryId?: string | null;
  brandId?: string | null;
  attributes?: Record<string, unknown>;
  seoSlug?: string | null;
  status?: ProductStatus;
  version: number;
}

export interface ProductListQuery {
  search?: string;
  status?: ProductStatus;
  cursor?: string;
  limit?: number;
}

export interface ProductVariantResponse {
  id: string;
  sku: string;
  specs: unknown;
  price: string;
  costPrice: string;
  weightG: string | null;
}

export interface ProductResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  brandId: string | null;
  attributes: unknown;
  seoSlug: string | null;
  status: ProductStatus;
  version: number;
  variants: ProductVariantResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductPageResponse {
  items: ProductResponse[];
  nextCursor: string | null;
}
