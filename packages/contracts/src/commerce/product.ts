export type ProductStatus = 'draft' | 'active' | 'archived' | 'sold';
export type CatalogItemStatus = 'active' | 'inactive';
export type ProductSortField = 'createdAt' | 'updatedAt' | 'price' | 'stock' | 'name';
export type SortOrder = 'asc' | 'desc';

/** 二手奢品通用鉴定与成色属性。 */
export interface LuxuryProductAttributes {
  usageCondition?: 'unused' | 'preowned';
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
  size?: string;
  customTips?: string;
  audience?: string;
  warrantyCard?: 'present' | 'absent';
  warrantyCardYear?: number;
  seriesId?: string;
  seriesName?: string;
  modelId?: string;
  modelName?: string;
  officialGuidePrice?: string;
  tags?: string[];
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
  usageCondition?: 'unused' | 'preowned';
  conditionGrade?: LuxuryProductAttributes['conditionGrade'];
  authenticityStatus?: LuxuryProductAttributes['authenticityStatus'];
  material?: string;
  color?: string;
  year?: number;
  origin?: string;
  accessories?: string[];
  appraisalOrganization?: string;
  appraisalCertificateNo?: string;
  size?: string;
  customTips?: string;
  audience?: string;
  warrantyCard?: 'present' | 'absent';
  warrantyCardYear?: number;
  seriesId?: string;
  seriesName?: string;
  modelId?: string;
  modelName?: string;
  officialGuidePrice?: string;
  tags?: string[];
}

export interface PublicProductVariantResponse {
  id: string;
  specs: unknown;
  price: string;
  /** 划线价（原价），可选；未提供时不展示降价对比。 */
  originalPrice?: string | null;
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
  detailMedia: Array<{
    assetId: string;
    type: 'image' | 'video';
    url: string;
    mimeType: string;
    sortOrder: number;
    durationSeconds: number | null;
  }>;
  primaryImage: string | null;
  availableStockQty: number;
  minimumPrice: string;
  maximumPrice: string;
  /** 平均评分（0~5），可选；未提供时不展示评分。 */
  rating?: number | null;
  /** 评价总数，可选；未提供时不展示评价数。 */
  reviewCount?: number | null;
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

/** 草稿恢复列表查询；服务端固定只返回未删除的 draft。 */
export interface ProductDraftListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

export interface DeleteProductDraftRequest {
  version: number;
}

export interface DeleteProductDraftResponse {
  deleted: true;
}

/** 复制草稿只复用资料和默认规格，不复用原媒体资源。 */
export interface DuplicateProductDraftRequest {
  version: number;
}

export enum ProductDraftErrorCode {
  VERSION_CONFLICT = 40901,
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

/** 商品上下架命令；原因会进入审计记录。 */
export interface ProductLifecycleCommandRequest {
  version: number;
  reason: string;
}

export type ProductLifecycleEventType = 'published' | 'unlisted' | 'relisted' | 'sold';

/** 商品生命周期只读事件，用于商家和平台追溯。 */
export interface ProductLifecycleEventResponse {
  id: string;
  type: ProductLifecycleEventType;
  fromStatus: ProductStatus | null;
  toStatus: ProductStatus;
  reason: string | null;
  actorId: string | null;
  occurredAt: string;
}

export enum ProductLifecycleErrorCode {
  INVALID_TRANSITION = 40902,
  INSUFFICIENT_STOCK = 40903,
  VALIDATION_FAILED = 40904,
  PUBLIC_UNLISTED = 40401,
  PUBLIC_SOLD = 40402,
}

export interface BatchUpdateProductsRequest {
  ids: string[];
  action: 'activate' | 'archive' | 'restore' | 'soft_delete';
}

export interface BatchUpdateProductsResponse {
  affected: number;
}
