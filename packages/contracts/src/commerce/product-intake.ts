export type ProductIntakeAction = 'stock_only' | 'stock_and_publish';
export type ProductCondition = 'unused' | 'preowned';
export type ProductOwnershipType = 'owned' | 'consigned' | 'pledged' | 'other';
export type WarrantyCardStatus = 'present' | 'absent';
export type ProductAccessory =
  | 'none'
  | 'box'
  | 'invoice'
  | 'receipt'
  | 'warranty_card'
  | 'identity_card'
  | 'bag'
  | 'manual'
  | 'dust_bag';

export type ProductIntakeMediaGroup =
  'detail_image' | 'detail_video' | 'recycling_image' | 'warranty_image' | 'remark_image';

export interface CreateProductIntakeRequest {
  idempotencyKey: string;
  action: ProductIntakeAction;
  title: string;
  description: string;
  customTips?: string;
  condition: ProductCondition;
  categoryId: string;
  brandId: string;
  seriesId?: string;
  modelId?: string;
  material?: string;
  size?: string;
  officialGuidePrice?: string;
  productCode?: string;
  ownershipType?: ProductOwnershipType;
  stockQuantity: number;
  inventoryAgeWarningDays?: number;
  totalCostPrice?: string;
  peerPrice?: string;
  agentPrice?: string;
  salePrice?: string;
  appraiserEmployeeId: string;
  recyclingTypeId?: string;
  recyclingEmployeeId?: string;
  recyclingNotes?: string;
  recycledAt: string;
  audience?: string;
  warrantyCard: WarrantyCardStatus;
  warrantyCardYear?: number;
  uniqueCode?: string;
  tags?: string[];
  accessories?: ProductAccessory[];
  internalNotes?: string;
  productImageAssetIds: string[];
  detailImageAssetIds?: string[];
  detailVideoAssetId?: string;
  detailVideoDurationSeconds?: number;
  recyclingImageAssetIds?: string[];
  warrantyImageAssetIds?: string[];
  remarkImageAssetIds?: string[];
}

export interface ProductIntakeMediaResponse {
  id: string;
  assetId: string;
  group: ProductIntakeMediaGroup;
  url: string;
  mimeType: string;
  sortOrder: number;
  durationSeconds: number | null;
}

export interface ProductIntakeResponse {
  id: string;
  productId: string;
  action: ProductIntakeAction;
  status: 'stocked' | 'published';
  title: string;
  description: string;
  customTips: string | null;
  condition: ProductCondition;
  categoryId: string;
  brandId: string;
  series: { id: string; name: string } | null;
  model: { id: string; name: string } | null;
  material: string | null;
  size: string | null;
  officialGuidePrice: string;
  productCode: string;
  ownershipType: ProductOwnershipType | null;
  stockQuantity: number;
  inventoryAgeWarningDays: number;
  totalCostPrice: string;
  peerPrice: string;
  agentPrice: string;
  salePrice: string;
  appraiser: { id: string; displayName: string };
  recyclingType: { id: string; name: string } | null;
  recyclingEmployee: { id: string; displayName: string } | null;
  recyclingNotes: string | null;
  recycledAt: string;
  audience: string | null;
  warrantyCard: WarrantyCardStatus;
  warrantyCardYear: number | null;
  uniqueCode: string | null;
  tags: string[];
  accessories: ProductAccessory[];
  internalNotes: string | null;
  productImages: Array<{
    assetId: string;
    url: string;
    sortOrder: number;
    isPrimary: boolean;
  }>;
  stockedAt: string;
  media: ProductIntakeMediaResponse[];
}

export interface CreateBrandSeriesRequest {
  name: string;
}
export interface UpdateBrandSeriesRequest {
  name: string;
  status: 'active' | 'inactive';
  version: number;
}
export interface BrandSeriesResponse {
  id: string;
  brandId: string;
  name: string;
  status: 'active' | 'inactive';
  version: number;
}

export interface CreateBrandModelRequest {
  name: string;
  seriesId?: string;
  categoryId?: string;
  officialGuidePrice?: string;
  defaultMaterial?: string;
}
export interface UpdateBrandModelRequest extends CreateBrandModelRequest {
  status: 'active' | 'inactive';
  version: number;
}
export interface BrandModelResponse {
  id: string;
  brandId: string;
  seriesId: string | null;
  seriesName: string | null;
  categoryId: string | null;
  name: string;
  officialGuidePrice: string | null;
  defaultMaterial: string | null;
  status: 'active' | 'inactive';
  version: number;
}

export interface IntakeEmployeeResponse {
  id: string;
  displayName: string;
  email: string;
}
export interface IntakeCategoryResponse {
  id: string;
  name: string;
}
export interface IntakeBrandResponse {
  id: string;
  name: string;
  englishName: string | null;
  initial: string;
  categoryIds: string[];
  logoUrl: string | null;
}
/** 通讯录式品牌目录，按 A-Z 分组，无法归类的品牌进入 #。 */
export interface BrandDirectoryGroupResponse {
  initial: string;
  brands: IntakeBrandResponse[];
}
export interface BrandDirectoryQuery {
  categoryId?: string;
  keyword?: string;
}
export interface BrandModelListQuery {
  seriesId?: string;
}
export interface RecyclingTypeResponse {
  id: string;
  name: string;
  sortOrder: number;
}

export enum ProductIntakeErrorCode {
  IDEMPOTENCY_CONFLICT = 40910,
  INVALID_RELATION = 40911,
  INVALID_MEDIA = 40912,
  INVALID_ACCESSORIES = 40913,
}
