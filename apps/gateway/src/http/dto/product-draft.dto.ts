/** 商品草稿入口运行时 DTO：拒绝非法金额、版本、媒体 ID 和未知字段。 */
import type {
  BindProductDraftMediaRequest,
  CreateProductDraftRequest,
  DeleteProductDraftRequest,
  DuplicateProductDraftRequest,
  ProductDraftListQuery,
  PublishProductDraftRequest,
  SaveProductDraftRequest,
} from '@saas/contracts';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const MONEY_PATTERN = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;
const CONDITION_GRADES = ['new', 'excellent', 'good', 'fair'] as const;
const AUTHENTICITY_STATUSES = ['pending', 'authenticated', 'rejected'] as const;

export class CreateProductDraftDto implements CreateProductDraftRequest {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}

export class ProductDraftListQueryDto implements ProductDraftListQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  keyword?: string;
}

export class DeleteProductDraftDto implements DeleteProductDraftRequest {
  @IsInt()
  @Min(0)
  version!: number;
}

export class DuplicateProductDraftDto implements DuplicateProductDraftRequest {
  @IsInt()
  @Min(0)
  version!: number;
}

export class SaveProductDraftDto implements SaveProductDraftRequest {
  @IsInt()
  @Min(0)
  version!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsUUID()
  brandId?: string | null;

  @IsOptional()
  @Matches(MONEY_PATTERN)
  price?: string;

  @IsOptional()
  @IsIn(CONDITION_GRADES)
  conditionGrade?: SaveProductDraftRequest['conditionGrade'];

  @IsOptional()
  @IsIn(AUTHENTICITY_STATUSES)
  authenticityStatus?: SaveProductDraftRequest['authenticityStatus'];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  material?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  color?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1800)
  @Max(2200)
  year?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  origin?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  accessories?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  appraisalOrganization?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  appraisalCertificateNo?: string | null;
}

export class BindProductDraftMediaDto implements BindProductDraftMediaRequest {
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  assetIds!: string[];

  @IsUUID()
  primaryAssetId!: string;

  @IsInt()
  @Min(0)
  version!: number;
}

export class PublishProductDraftDto implements PublishProductDraftRequest {
  @IsInt()
  @Min(0)
  version!: number;
}
