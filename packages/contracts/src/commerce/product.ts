export type ProductStatus = 'draft' | 'active' | 'archived';
export type CatalogItemStatus = 'active' | 'inactive';
export type ProductSortField = 'createdAt' | 'updatedAt' | 'price' | 'stock' | 'name';
export type SortOrder = 'asc' | 'desc';

/** 二手奢品通用鉴定与成色属性。 */
export interface LuxuryProductAttributes {
  conditionGrade?: 'new' | 'excellent' | 'good' | 'fair';
  authenticityStatus?: 'pending' | 'authenticated' | 'rejected';
  serialNumber?: string;
  material?: string;
  color?: string;
  year?: number;
  origin?: string;
  accessories?: string[];
  appraisalOrganization?: string;
  appraisalCertificateNo?: string;
  remarks?: string;
}

export interface CreateCategoryRequest {
  name: string;
  parentId?: string;
  sortOrder?: number;
}

export interface UpdateCategoryRequest {
  name: string;
  parentId?: string | null;
  sortOrder: number;
  status: CatalogItemStatus;
  version: number;
}

export interface CreateBrandRequest {
  name: string;
  logoUrl?: string;
}

export interface UpdateBrandRequest {
  name: string;
  logoUrl?: string | null;
  status: CatalogItemStatus;
  version: number;
}

export interface CategoryResponse {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  status: CatalogItemStatus;
  version: number;
  deletedAt: string | null;
  productCount: number;
  childCount: number;
}

export interface BrandResponse {
  id: string;
  name: string;
  logoUrl: string | null;
  status: CatalogItemStatus;
  version: number;
  deletedAt: string | null;
  productCount: number;
}

export interface CatalogListQuery {
  includeDeleted?: boolean;
}

export interface RestoreCatalogItemResponse {
  restored: true;
}

export interface DeleteCatalogItemResponse {
  deleted: true;
}

export interface CreateProductVariantRequest {
  sku: string;
  specs?: Record<string, unknown>;
  price: string;
  costPrice?: string;
  weightG?: string;
  initialStock?: number;
}

export interface UpdateProductVariantRequest {
  specs?: Record<string, unknown>;
  price?: string;
  costPrice?: string;
  weightG?: string | null;
  version: number;
}

export interface CreateProductRequest {
  code: string;
  name: string;
  description?: string;
  categoryId?: string;
  brandId?: string;
  attributes?: LuxuryProductAttributes;
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
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: ProductStatus;
  categoryId?: string;
  brandId?: string;
  stockState?: 'in_stock' | 'low_stock' | 'out_of_stock';
  sortBy?: ProductSortField;
  sortOrder?: SortOrder;
  includeDeleted?: boolean;
}

export interface ProductImageResponse {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
  sizeBytes: number;
  mimeType: string;
}

export interface CreateProductImageRequest {
  url: string;
  altText?: string;
  sizeBytes: number;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface SortProductImagesRequest {
  imageIds: string[];
  primaryImageId: string;
}

export interface ProductVariantResponse {
  id: string;
  sku: string;
  specs: unknown;
  price: string;
  costPrice: string;
  weightG: string | null;
  version: number;
  stockQty: number;
  availableStockQty: number;
}

export interface ProductResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  brandId: string | null;
  attributes: LuxuryProductAttributes;
  seoSlug: string | null;
  status: ProductStatus;
  version: number;
  variants: ProductVariantResponse[];
  images: ProductImageResponse[];
  primaryImage: string | null;
  stockQty: number;
  availableStockQty: number;
  minimumPrice: string;
  maximumPrice: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPageResponse {
  list: ProductResponse[];
  total: number;
  page: number;
  pageSize: number;
}

/** 消费者商品查询参数；不允许客户端指定状态或读取已删除数据。 */
export interface PublicProductListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  categoryId?: string;
  brandId?: string;
  sortBy?: 'createdAt' | 'price';
  sortOrder?: SortOrder;
}

/** 消费者可见的鉴定和成色字段白名单。 */
export interface PublicProductAttributes {
  conditionGrade?: LuxuryProductAttributes['conditionGrade'];
  authenticityStatus?: LuxuryProductAttributes['authenticityStatus'];
  material?: string;
  color?: string;
  year?: number;
  origin?: string;
  accessories?: string[];
  appraisalOrganization?: string;
  appraisalCertificateNo?: string;
}

export interface PublicProductVariantResponse {
  id: string;
  specs: unknown;
  price: string;
  availableStockQty: number;
}

/** 消费者公开商品读模型；严禁加入成本价、内部备注和乐观锁版本。 */
export interface PublicProductResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  brandId: string | null;
  attributes: PublicProductAttributes;
  variants: PublicProductVariantResponse[];
  images: ProductImageResponse[];
  primaryImage: string | null;
  availableStockQty: number;
  minimumPrice: string;
  maximumPrice: string;
  createdAt: string;
}

export interface PublicProductPageResponse {
  list: PublicProductResponse[];
  total: number;
  page: number;
  pageSize: number;
}

/** 创建空白商品草稿；编号由服务端生成，避免客户端碰撞。 */
export interface CreateProductDraftRequest {
  name?: string;
}

/** 草稿增量自动保存请求，version 用于并发编辑保护。 */
export interface SaveProductDraftRequest {
  version: number;
  name?: string;
  description?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  price?: string;
  conditionGrade?: LuxuryProductAttributes['conditionGrade'] | null;
  authenticityStatus?: LuxuryProductAttributes['authenticityStatus'] | null;
  material?: string | null;
  color?: string | null;
  year?: number | null;
  origin?: string | null;
  accessories?: string[];
  appraisalOrganization?: string | null;
  appraisalCertificateNo?: string | null;
}

/** 草稿图片绑定只接受已确认的 MediaAsset ID，不接受任意 URL。 */
export interface BindProductDraftMediaRequest {
  assetIds: string[];
  primaryAssetId: string;
  version: number;
}

export type ProductPublishField =
  'name' | 'categoryId' | 'price' | 'conditionGrade' | 'images' | 'stock';

export interface ProductPublishIssue {
  field: ProductPublishField;
  message: string;
}

export interface ProductPublishValidationResponse {
  valid: boolean;
  issues: ProductPublishIssue[];
}

export interface PublishProductDraftResponse {
  product: ProductResponse;
  publishedAt: string;
}

export interface PublishProductDraftRequest {
  version: number;
}

export interface BatchUpdateProductsRequest {
  ids: string[];
  action: 'activate' | 'archive' | 'restore' | 'soft_delete';
}

export interface BatchUpdateProductsResponse {
  affected: number;
}
