import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  CreateBrandModelRequest,
  CreateBrandSeriesRequest,
  CreateProductIntakeRequest,
  BrandDirectoryQuery,
  BrandModelListQuery,
  UpdateBrandModelRequest,
  UpdateBrandSeriesRequest,
} from '@saas/contracts';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const MONEY = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;
const ACCESSORIES = [
  'none',
  'box',
  'invoice',
  'receipt',
  'warranty_card',
  'identity_card',
  'bag',
  'manual',
  'dust_bag',
] as const;
export class CreateProductIntakeDto implements CreateProductIntakeRequest {
  @ApiProperty({ type: String, description: '客户端生成的幂等键', minLength: 8, maxLength: 100 })
  @IsString()
  @Length(8, 100)
  idempotencyKey!: string;
  @ApiProperty({ type: String, enum: ['stock_only', 'stock_and_publish'] })
  @IsIn(['stock_only', 'stock_and_publish'])
  action!: CreateProductIntakeRequest['action'];
  @ApiProperty({ type: String, maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;
  @ApiProperty({ type: String, maxLength: 250 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  description!: string;
  @ApiPropertyOptional({ type: String, maxLength: 250 })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  customTips?: string;
  @ApiProperty({ type: String, enum: ['unused', 'preowned'] })
  @IsIn(['unused', 'preowned'])
  condition!: CreateProductIntakeRequest['condition'];
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID() categoryId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID() brandId!: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' }) @IsOptional() @IsUUID() seriesId?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' }) @IsOptional() @IsUUID() modelId?: string;
  @ApiPropertyOptional({ type: String, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  material?: string;
  @ApiPropertyOptional({ type: String, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  size?: string;
  @ApiPropertyOptional({ type: String, default: '0.00' })
  @IsOptional()
  @Matches(MONEY)
  officialGuidePrice?: string;
  @ApiPropertyOptional({ type: String, maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  productCode?: string;
  @ApiPropertyOptional({ type: String, enum: ['owned', 'consigned', 'pledged', 'other'] })
  @IsOptional()
  @IsIn(['owned', 'consigned', 'pledged', 'other'])
  ownershipType?: CreateProductIntakeRequest['ownershipType'];
  @ApiProperty({ type: Number, minimum: 1 }) @IsInt() @Min(1) @Max(1000000) stockQuantity!: number;
  @ApiPropertyOptional({ type: Number, default: 90, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36500)
  inventoryAgeWarningDays?: number;
  @ApiPropertyOptional({ type: String, default: '0.00' })
  @IsOptional()
  @Matches(MONEY)
  totalCostPrice?: string;
  @ApiPropertyOptional({ type: String, default: '0.00' })
  @IsOptional()
  @Matches(MONEY)
  peerPrice?: string;
  @ApiPropertyOptional({ type: String, default: '0.00' })
  @IsOptional()
  @Matches(MONEY)
  agentPrice?: string;
  @ApiPropertyOptional({ type: String, default: '0.00' })
  @IsOptional()
  @Matches(MONEY)
  salePrice?: string;
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID() appraiserEmployeeId!: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  recyclingTypeId?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  recyclingEmployeeId?: string;
  @ApiPropertyOptional({ type: String, maxLength: 250 })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  recyclingNotes?: string;
  @ApiProperty({ type: String, format: 'date-time' }) @IsDateString() recycledAt!: string;
  @ApiPropertyOptional({ type: String, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  audience?: string;
  @ApiProperty({ type: String, enum: ['present', 'absent'] })
  @IsIn(['present', 'absent'])
  warrantyCard!: CreateProductIntakeRequest['warrantyCard'];
  @ApiPropertyOptional({ type: Number, minimum: 1900 })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  warrantyCardYear?: number;
  @ApiPropertyOptional({ type: String, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  uniqueCode?: string;
  @ApiPropertyOptional({ type: [String], maxItems: 30 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];
  @ApiPropertyOptional({ enum: ACCESSORIES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @ArrayUnique()
  @IsIn(ACCESSORIES, { each: true })
  accessories?: CreateProductIntakeRequest['accessories'];
  @ApiPropertyOptional({ type: String, maxLength: 250 })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  internalNotes?: string;
  @ApiProperty({ type: [String], minItems: 1, maxItems: 9 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  productImageAssetIds!: string[];
  @ApiPropertyOptional({ type: [String], maxItems: 50 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  detailImageAssetIds?: string[];
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  detailVideoAssetId?: string;
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  detailVideoDurationSeconds?: number;
  @ApiPropertyOptional({ type: [String], maxItems: 9 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  recyclingImageAssetIds?: string[];
  @ApiPropertyOptional({ type: [String], maxItems: 9 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  warrantyImageAssetIds?: string[];
  @ApiPropertyOptional({ type: [String], maxItems: 25 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  remarkImageAssetIds?: string[];
}

export class CreateBrandSeriesDto implements CreateBrandSeriesRequest {
  @ApiProperty({ type: String, maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}
export class UpdateBrandSeriesDto extends CreateBrandSeriesDto implements UpdateBrandSeriesRequest {
  @ApiProperty({ type: String, enum: ['active', 'inactive'] })
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';
  @ApiProperty({ type: Number, minimum: 0 }) @IsInt() @Min(0) version!: number;
}
export class CreateBrandModelDto implements CreateBrandModelRequest {
  @ApiProperty({ type: String, maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' }) @IsOptional() @IsUUID() seriesId?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
  @ApiPropertyOptional({ type: String }) @IsOptional() @Matches(MONEY) officialGuidePrice?: string;
  @ApiPropertyOptional({ type: String, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultMaterial?: string;
}
export class UpdateBrandModelDto extends CreateBrandModelDto implements UpdateBrandModelRequest {
  @ApiProperty({ type: String, enum: ['active', 'inactive'] })
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';
  @ApiProperty({ type: Number, minimum: 0 }) @IsInt() @Min(0) version!: number;
}

export class BrandDirectoryQueryDto implements BrandDirectoryQuery {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ type: String, maxLength: 100, description: '匹配品牌中英文名称' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;
}

export class BrandModelListQueryDto implements BrandModelListQuery {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  seriesId?: string;
}
