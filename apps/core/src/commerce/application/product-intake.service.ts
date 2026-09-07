import { createHash, randomUUID } from 'node:crypto';

import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  BrandModelResponse,
  BrandDirectoryGroupResponse,
  BrandSeriesResponse,
  CreateBrandModelRequest,
  CreateBrandSeriesRequest,
  CreateProductIntakeRequest,
  IntakeEmployeeResponse,
  IntakeCategoryResponse,
  IntakeBrandResponse,
  ProductIntakeMediaGroup,
  ProductIntakeResponse,
  RecyclingTypeResponse,
  UpdateBrandModelRequest,
  UpdateBrandSeriesRequest,
} from '@saas/contracts';
import { ProductIntakeErrorCode } from '@saas/contracts';

import { Prisma, type BrandModel, type BrandSeries } from '../../generated/prisma/index.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';

const DEFAULT_CATEGORIES = ['腕表', '箱包', '珠宝', '服饰', '其他', '配饰'] as const;
const DEFAULT_RECYCLING_TYPES = ['其他', '线上', '同行', '门店'] as const;
const MONEY_FIELDS = [
  'officialGuidePrice',
  'totalCostPrice',
  'peerPrice',
  'agentPrice',
  'salePrice',
] as const;
const ACCESSORIES = new Set([
  'none',
  'box',
  'invoice',
  'receipt',
  'warranty_card',
  'identity_card',
  'bag',
  'manual',
  'dust_bag',
]);
const MONEY_PATTERN = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;

@Injectable()
export class ProductIntakeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async categories(tenantId: string): Promise<IntakeCategoryResponse[]> {
    return this.prisma.$transaction(async (tx) => {
      await setTenant(tx, tenantId);
      await ensureDefaults(tx, tenantId);
      return tx.category.findMany({
        where: { tenantId, status: 'active', deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
    });
  }

  brands(tenantId: string, categoryId?: string, keyword?: string): Promise<IntakeBrandResponse[]> {
    return this.prisma.$transaction(async (tx) => {
      await setTenant(tx, tenantId);
      const normalizedKeyword = keyword?.normalize('NFKC').trim();
      const rows = await tx.brand.findMany({
        where: {
          tenantId,
          status: 'active',
          deletedAt: null,
          ...(categoryId ? { categories: { some: { tenantId, categoryId } } } : {}),
          ...(normalizedKeyword
            ? {
                OR: [
                  { name: { contains: normalizedKeyword, mode: 'insensitive' } },
                  { englishName: { contains: normalizedKeyword, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        include: { categories: { select: { categoryId: true } } },
        orderBy: [{ initial: 'asc' }, { englishName: 'asc' }, { name: 'asc' }],
      });
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        englishName: row.englishName,
        initial: normalizeInitial(row.initial),
        categoryIds: row.categories.map((item) => item.categoryId),
        logoUrl: row.logoUrl,
      }));
    });
  }

  async brandDirectory(
    tenantId: string,
    categoryId?: string,
    keyword?: string,
  ): Promise<BrandDirectoryGroupResponse[]> {
    const brands = await this.brands(tenantId, categoryId, keyword);
    const grouped = new Map<string, IntakeBrandResponse[]>();
    for (const brand of brands) {
      const entries = grouped.get(brand.initial) ?? [];
      entries.push(brand);
      grouped.set(brand.initial, entries);
    }
    return [...grouped.entries()].map(([initial, entries]) => ({ initial, brands: entries }));
  }

  async employees(tenantId: string): Promise<IntakeEmployeeResponse[]> {
    const rows = await this.prisma.adminUser.findMany({
      where: { tenantId, status: 'active' },
      select: { id: true, displayName: true, email: true },
      orderBy: { displayName: 'asc' },
    });
    return rows;
  }

  async recyclingTypes(tenantId: string): Promise<RecyclingTypeResponse[]> {
    return this.prisma.$transaction(async (tx) => {
      await setTenant(tx, tenantId);
      await ensureDefaults(tx, tenantId);
      return tx.recyclingType.findMany({
        where: { tenantId, status: 'active' },
        select: { id: true, name: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      });
    });
  }

  async listSeries(tenantId: string, brandId: string): Promise<BrandSeriesResponse[]> {
    await this.requireBrand(tenantId, brandId);
    const rows = await this.prisma.brandSeries.findMany({
      where: { tenantId, brandId, status: 'active', deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return rows.map(seriesResponse);
  }

  async createSeries(
    tenantId: string,
    brandId: string,
    input: CreateBrandSeriesRequest,
  ): Promise<BrandSeriesResponse> {
    await this.requireBrand(tenantId, brandId);
    const row = await this.prisma.brandSeries.create({
      data: { tenantId, brandId, name: input.name.trim() },
    });
    return seriesResponse(row);
  }

  async updateSeries(
    tenantId: string,
    brandId: string,
    id: string,
    input: UpdateBrandSeriesRequest,
  ): Promise<BrandSeriesResponse> {
    const changed = await this.prisma.brandSeries.updateMany({
      where: { id, tenantId, brandId, version: input.version, deletedAt: null },
      data: { name: input.name.trim(), status: input.status, version: { increment: 1 } },
    });
    if (!changed.count) throw new ConflictException('系列不存在或版本已变化');
    const row = await this.prisma.brandSeries.findFirstOrThrow({
      where: { id, tenantId, brandId },
    });
    return seriesResponse(row);
  }

  async listModels(
    tenantId: string,
    brandId: string,
    seriesId?: string,
  ): Promise<BrandModelResponse[]> {
    await this.requireBrand(tenantId, brandId);
    if (seriesId) await this.requireSeries(tenantId, brandId, seriesId);
    const rows = await this.prisma.brandModel.findMany({
      where: { tenantId, brandId, seriesId, status: 'active', deletedAt: null },
      include: { series: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(modelResponse);
  }

  async createModel(
    tenantId: string,
    brandId: string,
    input: CreateBrandModelRequest,
  ): Promise<BrandModelResponse> {
    await this.validateModelRelations(tenantId, brandId, input.seriesId, input.categoryId);
    assertOptionalMoney(input.officialGuidePrice, 'officialGuidePrice');
    const row = await this.prisma.brandModel.create({
      data: {
        tenantId,
        brandId,
        name: input.name.trim(),
        seriesId: input.seriesId,
        categoryId: input.categoryId,
        officialGuidePrice: input.officialGuidePrice,
        defaultMaterial: input.defaultMaterial?.trim(),
      },
      include: { series: true },
    });
    return modelResponse(row);
  }

  async updateModel(
    tenantId: string,
    brandId: string,
    id: string,
    input: UpdateBrandModelRequest,
  ): Promise<BrandModelResponse> {
    await this.validateModelRelations(tenantId, brandId, input.seriesId, input.categoryId);
    assertOptionalMoney(input.officialGuidePrice, 'officialGuidePrice');
    const changed = await this.prisma.brandModel.updateMany({
      where: { id, tenantId, brandId, version: input.version, deletedAt: null },
      data: {
        name: input.name.trim(),
        seriesId: input.seriesId,
        categoryId: input.categoryId,
        officialGuidePrice: input.officialGuidePrice,
        defaultMaterial: input.defaultMaterial?.trim(),
        status: input.status,
        version: { increment: 1 },
      },
    });
    if (!changed.count) throw new ConflictException('型号不存在或版本已变化');
    const row = await this.prisma.brandModel.findFirstOrThrow({
      where: { id, tenantId, brandId },
      include: { series: true },
    });
    return modelResponse(row);
  }

  async create(
    tenantId: string,
    actorId: string,
    input: CreateProductIntakeRequest,
  ): Promise<ProductIntakeResponse> {
    validateInput(input);
    const fingerprint = fingerprintOf(input);
    return this.prisma.$transaction(
      async (tx) => {
        await setTenant(tx, tenantId);
        const previous = await tx.productIntake.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
        });
        if (previous) {
          if (previous.requestFingerprint !== fingerprint)
            throw intakeConflict(
              ProductIntakeErrorCode.IDEMPOTENCY_CONFLICT,
              '幂等键已用于不同的入库请求',
            );
          return intakeResponse(tx, tenantId, previous);
        }
        await ensureDefaults(tx, tenantId);
        await assertProductQuota(tx, tenantId);
        const [category, brand, appraiser, recycler, recyclingType] = await Promise.all([
          tx.category.findFirst({
            where: { id: input.categoryId, tenantId, status: 'active', deletedAt: null },
          }),
          tx.brand.findFirst({
            where: { id: input.brandId, tenantId, status: 'active', deletedAt: null },
          }),
          tx.adminUser.findFirst({
            where: { id: input.appraiserEmployeeId, tenantId, status: 'active' },
          }),
          input.recyclingEmployeeId
            ? tx.adminUser.findFirst({
                where: { id: input.recyclingEmployeeId, tenantId, status: 'active' },
              })
            : null,
          input.recyclingTypeId
            ? tx.recyclingType.findFirst({
                where: { id: input.recyclingTypeId, tenantId, status: 'active' },
              })
            : null,
        ]);
        if (
          !category ||
          !brand ||
          !appraiser ||
          (input.recyclingEmployeeId && !recycler) ||
          (input.recyclingTypeId && !recyclingType)
        )
          throw intakeConflict(
            ProductIntakeErrorCode.INVALID_RELATION,
            '分类、品牌、员工或回收类型无效',
          );
        const { series, model } = await resolveModel(tx, tenantId, input);
        const groups = mediaGroups(input);
        const assetIds = groups.flatMap((entry) => entry.assetIds);
        if (new Set(assetIds).size !== assetIds.length)
          throw intakeConflict(
            ProductIntakeErrorCode.INVALID_MEDIA,
            '同一媒体不能重复用于多个分组',
          );
        const assets = await tx.mediaAsset.findMany({
          where: { id: { in: assetIds }, tenantId, status: 'temporary', deletedAt: null },
          include: { productImage: true, productIntakeMedia: true },
        });
        if (
          assets.length !== assetIds.length ||
          assets.some((asset) => asset.productImage || asset.productIntakeMedia)
        )
          throw intakeConflict(
            ProductIntakeErrorCode.INVALID_MEDIA,
            '包含不可绑定或已被占用的媒体',
          );
        validateMedia(groups, assets);
        const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
        const code = input.productCode?.trim() || `STOCK-${suffix}`;
        const salePrice = input.salePrice ?? '0.00';
        const product = await tx.product.create({
          data: {
            tenantId,
            code,
            name: input.title.trim(),
            description: input.description.trim(),
            categoryId: input.categoryId,
            brandId: input.brandId,
            attributes: {
              usageCondition: input.condition,
              material: input.material?.trim() ?? model?.defaultMaterial ?? undefined,
              size: input.size?.trim(),
              customTips: input.customTips?.trim(),
              audience: input.audience?.trim(),
              warrantyCard: input.warrantyCard,
              warrantyCardYear: input.warrantyCardYear,
              seriesId: series?.id,
              seriesName: series?.name,
              modelId: model?.id,
              modelName: model?.name,
              officialGuidePrice:
                input.officialGuidePrice ?? model?.officialGuidePrice?.toFixed(2) ?? '0.00',
              tags: input.tags ?? [],
              accessories: input.accessories ?? [],
            },
            status: input.action === 'stock_and_publish' ? 'active' : 'archived',
            createdBy: actorId,
            updatedBy: actorId,
            variants: {
              create: {
                tenantId,
                sku: `SKU-${suffix}`,
                price: salePrice,
                costPrice: input.totalCostPrice ?? '0.00',
                specs: {
                  material: input.material?.trim() ?? model?.defaultMaterial ?? undefined,
                  size: input.size?.trim(),
                },
              },
            },
          },
          include: { variants: true },
        });
        const variant = product.variants[0];
        if (!variant) throw new ConflictException('商品默认规格创建失败');
        const intake = await tx.productIntake.create({
          data: {
            tenantId,
            productId: product.id,
            idempotencyKey: input.idempotencyKey,
            requestFingerprint: fingerprint,
            action: input.action,
            customTips: input.customTips?.trim(),
            condition: input.condition,
            seriesId: series?.id,
            modelId: model?.id,
            officialGuidePrice: input.officialGuidePrice ?? model?.officialGuidePrice ?? '0.00',
            ownershipType: input.ownershipType,
            stockQuantity: input.stockQuantity,
            inventoryAgeWarningDays: input.inventoryAgeWarningDays ?? 90,
            totalCostPrice: input.totalCostPrice ?? '0.00',
            peerPrice: input.peerPrice ?? '0.00',
            agentPrice: input.agentPrice ?? '0.00',
            appraiserEmployeeId: appraiser.id,
            appraiserName: appraiser.displayName,
            recyclingTypeId: recyclingType?.id,
            recyclingEmployeeId: recycler?.id,
            recyclingEmployeeName: recycler?.displayName,
            recyclingNotes: input.recyclingNotes?.trim(),
            recycledAt: new Date(input.recycledAt),
            audience: input.audience?.trim(),
            warrantyCard: input.warrantyCard,
            warrantyCardYear: input.warrantyCardYear,
            uniqueCode: input.uniqueCode?.trim(),
            tags: input.tags ?? [],
            accessories: input.accessories ?? [],
            internalNotes: input.internalNotes?.trim(),
          },
        });
        const mainIds = input.productImageAssetIds;
        for (const [sortOrder, assetId] of mainIds.entries()) {
          const asset = assets.find((item) => item.id === assetId)!;
          await tx.productImage.create({
            data: {
              tenantId,
              productId: product.id,
              mediaAssetId: asset.id,
              url: publicUrl(tenantId, asset.id),
              altText: product.name,
              sortOrder,
              isPrimary: sortOrder === 0,
              sizeBytes: asset.sizeBytes,
              mimeType: asset.mimeType,
            },
          });
        }
        for (const group of groups.filter((entry) => entry.group !== 'product_image')) {
          for (const [sortOrder, assetId] of group.assetIds.entries())
            await tx.productIntakeMedia.create({
              data: {
                tenantId,
                intakeId: intake.id,
                mediaAssetId: assetId,
                group: group.group,
                visibility: group.visibility,
                sortOrder,
                durationSeconds:
                  group.group === 'detail_video' ? input.detailVideoDurationSeconds : null,
              },
            });
        }
        await tx.mediaAsset.updateMany({
          where: { id: { in: assetIds }, tenantId },
          data: { status: 'attached' },
        });
        await tx.inventoryTransaction.create({
          data: {
            tenantId,
            variantId: variant.id,
            type: 'initial',
            qtyChange: input.stockQuantity,
            referenceType: 'product_intake',
            referenceId: intake.id,
            reason: '商品入库',
            operatorId: actorId,
          },
        });
        await recordUsage(tx, tenantId);
        await recordEvent(tx, tenantId, actorId, product.id, 'product.stocked', {
          intakeId: intake.id,
          stockQuantity: input.stockQuantity,
        });
        if (input.action === 'stock_and_publish')
          await recordEvent(tx, tenantId, actorId, product.id, 'product.published', {
            intakeId: intake.id,
            source: 'product_intake',
          });
        return intakeResponse(tx, tenantId, intake);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 },
    );
  }

  private async requireBrand(tenantId: string, brandId: string): Promise<void> {
    const row = await this.prisma.brand.findFirst({
      where: { id: brandId, tenantId, status: 'active', deletedAt: null },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('品牌不存在');
  }

  private async requireSeries(tenantId: string, brandId: string, seriesId: string): Promise<void> {
    const row = await this.prisma.brandSeries.findFirst({
      where: { id: seriesId, tenantId, brandId, status: 'active', deletedAt: null },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('系列不存在或不属于该品牌');
  }

  private async validateModelRelations(
    tenantId: string,
    brandId: string,
    seriesId?: string,
    categoryId?: string,
  ): Promise<void> {
    await this.requireBrand(tenantId, brandId);
    if (
      seriesId &&
      !(await this.prisma.brandSeries.findFirst({
        where: { id: seriesId, tenantId, brandId, status: 'active', deletedAt: null },
      }))
    )
      throw intakeConflict(ProductIntakeErrorCode.INVALID_RELATION, '系列不属于该品牌');
    if (
      categoryId &&
      !(await this.prisma.category.findFirst({
        where: { id: categoryId, tenantId, status: 'active', deletedAt: null },
      }))
    )
      throw intakeConflict(ProductIntakeErrorCode.INVALID_RELATION, '分类无效');
  }
}

type Tx = Prisma.TransactionClient;
type MediaGroup = {
  group: 'product_image' | ProductIntakeMediaGroup;
  visibility: 'public' | 'internal';
  assetIds: string[];
};

function validateInput(input: CreateProductIntakeRequest): void {
  for (const field of MONEY_FIELDS) assertOptionalMoney(input[field], field);
  if (input.warrantyCard === 'absent' && input.warrantyCardYear !== undefined)
    throw new ConflictException('无保卡时不能填写保卡年份');
  const year = new Date().getFullYear();
  if (
    input.warrantyCardYear !== undefined &&
    (input.warrantyCardYear < 1900 || input.warrantyCardYear > year + 1)
  )
    throw new ConflictException('保卡年份无效');
  const accessories = input.accessories ?? [];
  if (
    accessories.some((item) => !ACCESSORIES.has(item)) ||
    (accessories.includes('none') && accessories.length > 1)
  )
    throw intakeConflict(ProductIntakeErrorCode.INVALID_ACCESSORIES, '商品附件选项无效');
  if (
    (input.detailVideoAssetId && input.detailVideoDurationSeconds === undefined) ||
    (!input.detailVideoAssetId && input.detailVideoDurationSeconds !== undefined) ||
    (input.detailVideoDurationSeconds !== undefined &&
      (input.detailVideoDurationSeconds <= 0 || input.detailVideoDurationSeconds > 60))
  )
    throw intakeConflict(ProductIntakeErrorCode.INVALID_MEDIA, '细节视频时长必须在 1 到 60 秒之间');
}

function mediaGroups(input: CreateProductIntakeRequest): MediaGroup[] {
  return [
    { group: 'product_image', visibility: 'public', assetIds: input.productImageAssetIds },
    { group: 'detail_image', visibility: 'public', assetIds: input.detailImageAssetIds ?? [] },
    {
      group: 'detail_video',
      visibility: 'public',
      assetIds: input.detailVideoAssetId ? [input.detailVideoAssetId] : [],
    },
    {
      group: 'recycling_image',
      visibility: 'internal',
      assetIds: input.recyclingImageAssetIds ?? [],
    },
    {
      group: 'warranty_image',
      visibility: 'internal',
      assetIds: input.warrantyImageAssetIds ?? [],
    },
    { group: 'remark_image', visibility: 'internal', assetIds: input.remarkImageAssetIds ?? [] },
  ];
}

function validateMedia(
  groups: MediaGroup[],
  assets: Array<{ id: string; mimeType: string }>,
): void {
  const limits: Record<MediaGroup['group'], number> = {
    product_image: 9,
    detail_image: 50,
    detail_video: 1,
    recycling_image: 9,
    warranty_image: 9,
    remark_image: 25,
  };
  for (const group of groups) {
    if (
      (group.group === 'product_image' && group.assetIds.length < 1) ||
      group.assetIds.length > limits[group.group]
    )
      throw intakeConflict(ProductIntakeErrorCode.INVALID_MEDIA, `${group.group} 媒体数量无效`);
    for (const id of group.assetIds) {
      const mime = assets.find((asset) => asset.id === id)?.mimeType;
      const valid =
        group.group === 'detail_video' ? mime === 'video/mp4' : mime?.startsWith('image/');
      if (!valid)
        throw intakeConflict(ProductIntakeErrorCode.INVALID_MEDIA, `${group.group} 媒体类型无效`);
    }
  }
}

async function resolveModel(
  tx: Tx,
  tenantId: string,
  input: CreateProductIntakeRequest,
): Promise<{ model: BrandModel | null; series: BrandSeries | null }> {
  const model = input.modelId
    ? await tx.brandModel.findFirst({
        where: {
          id: input.modelId,
          tenantId,
          brandId: input.brandId,
          status: 'active',
          deletedAt: null,
        },
      })
    : null;
  if (input.modelId && !model)
    throw intakeConflict(ProductIntakeErrorCode.INVALID_RELATION, '型号不属于所选品牌');
  if (model?.categoryId && model.categoryId !== input.categoryId)
    throw intakeConflict(ProductIntakeErrorCode.INVALID_RELATION, '型号与商品分类不匹配');
  if (model?.seriesId && input.seriesId && model.seriesId !== input.seriesId)
    throw intakeConflict(ProductIntakeErrorCode.INVALID_RELATION, '型号与系列不匹配');
  const seriesId = model?.seriesId ?? input.seriesId;
  const series = seriesId
    ? await tx.brandSeries.findFirst({
        where: {
          id: seriesId,
          tenantId,
          brandId: input.brandId,
          status: 'active',
          deletedAt: null,
        },
      })
    : null;
  if (seriesId && !series)
    throw intakeConflict(ProductIntakeErrorCode.INVALID_RELATION, '系列不属于所选品牌');
  return { model, series };
}

async function ensureDefaults(tx: Tx, tenantId: string): Promise<void> {
  await tx.category.createMany({
    data: DEFAULT_CATEGORIES.map((name, sortOrder) => ({ tenantId, name, sortOrder })),
    skipDuplicates: true,
  });
  await tx.recyclingType.createMany({
    data: DEFAULT_RECYCLING_TYPES.map((name, sortOrder) => ({ tenantId, name, sortOrder })),
    skipDuplicates: true,
  });
}

async function intakeResponse(
  tx: Tx,
  tenantId: string,
  source: { id: string },
): Promise<ProductIntakeResponse> {
  const intake = await tx.productIntake.findFirstOrThrow({
    where: { id: source.id, tenantId },
    include: {
      series: true,
      model: true,
      recyclingType: true,
      product: {
        include: {
          variants: { orderBy: { createdAt: 'asc' } },
          images: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
        },
      },
      media: {
        include: { mediaAsset: true },
        orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }],
      },
    },
  });
  const attributes = jsonObject(intake.product.attributes);
  const variant = intake.product.variants[0];
  return {
    id: intake.id,
    productId: intake.productId,
    action: intake.action as ProductIntakeResponse['action'],
    status: intake.action === 'stock_and_publish' ? 'published' : 'stocked',
    title: intake.product.name,
    description: intake.product.description ?? '',
    customTips: intake.customTips,
    condition: intake.condition as ProductIntakeResponse['condition'],
    categoryId: intake.product.categoryId ?? '',
    brandId: intake.product.brandId ?? '',
    series: intake.series ? { id: intake.series.id, name: intake.series.name } : null,
    model: intake.model ? { id: intake.model.id, name: intake.model.name } : null,
    material: typeof attributes.material === 'string' ? attributes.material : null,
    size: typeof attributes.size === 'string' ? attributes.size : null,
    officialGuidePrice: intake.officialGuidePrice.toFixed(2),
    productCode: intake.product.code,
    ownershipType: intake.ownershipType as ProductIntakeResponse['ownershipType'],
    stockQuantity: intake.stockQuantity,
    inventoryAgeWarningDays: intake.inventoryAgeWarningDays,
    totalCostPrice: intake.totalCostPrice.toFixed(2),
    peerPrice: intake.peerPrice.toFixed(2),
    agentPrice: intake.agentPrice.toFixed(2),
    salePrice: variant?.price.toFixed(2) ?? '0.00',
    appraiser: { id: intake.appraiserEmployeeId, displayName: intake.appraiserName },
    recyclingType: intake.recyclingType
      ? { id: intake.recyclingType.id, name: intake.recyclingType.name }
      : null,
    recyclingEmployee:
      intake.recyclingEmployeeId && intake.recyclingEmployeeName
        ? { id: intake.recyclingEmployeeId, displayName: intake.recyclingEmployeeName }
        : null,
    recyclingNotes: intake.recyclingNotes,
    recycledAt: intake.recycledAt.toISOString(),
    audience: intake.audience,
    warrantyCard: intake.warrantyCard as ProductIntakeResponse['warrantyCard'],
    warrantyCardYear: intake.warrantyCardYear,
    uniqueCode: intake.uniqueCode,
    tags: stringArray(intake.tags),
    accessories: stringArray(intake.accessories) as ProductIntakeResponse['accessories'],
    internalNotes: intake.internalNotes,
    productImages: intake.product.images.flatMap((image) =>
      image.mediaAssetId
        ? [
            {
              assetId: image.mediaAssetId,
              url: image.url,
              sortOrder: image.sortOrder,
              isPrimary: image.isPrimary,
            },
          ]
        : [],
    ),
    stockedAt: intake.stockedAt.toISOString(),
    media: intake.media.map((item) => ({
      id: item.id,
      assetId: item.mediaAssetId,
      group: item.group as ProductIntakeMediaGroup,
      url:
        item.visibility === 'public'
          ? publicUrl(tenantId, item.mediaAssetId)
          : `/api/media/assets/${item.mediaAssetId}/content`,
      mimeType: item.mediaAsset.mimeType,
      sortOrder: item.sortOrder,
      durationSeconds: item.durationSeconds,
    })),
  };
}

function jsonObject(value: Prisma.JsonValue): Prisma.JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}

function stringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function seriesResponse(row: {
  id: string;
  brandId: string;
  name: string;
  status: string;
  version: number;
}): BrandSeriesResponse {
  return { ...row, status: row.status as BrandSeriesResponse['status'] };
}
function modelResponse(row: {
  id: string;
  brandId: string;
  seriesId: string | null;
  categoryId: string | null;
  name: string;
  officialGuidePrice: Prisma.Decimal | null;
  defaultMaterial: string | null;
  status: string;
  version: number;
  series: { name: string } | null;
}): BrandModelResponse {
  return {
    id: row.id,
    brandId: row.brandId,
    seriesId: row.seriesId,
    seriesName: row.series?.name ?? null,
    categoryId: row.categoryId,
    name: row.name,
    officialGuidePrice: row.officialGuidePrice?.toFixed(2) ?? null,
    defaultMaterial: row.defaultMaterial,
    status: row.status as BrandModelResponse['status'],
    version: row.version,
  };
}
function fingerprintOf(input: CreateProductIntakeRequest): string {
  return createHash('sha256').update(stableStringify(input)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizeInitial(value: string): string {
  const initial = value.trim().toUpperCase();
  return /^[A-Z]$/.test(initial) ? initial : '#';
}
function publicUrl(tenantId: string, assetId: string): string {
  return `/api/media/public/assets/${assetId}/content?tenantId=${encodeURIComponent(tenantId)}`;
}
function assertOptionalMoney(value: string | undefined, field: string): void {
  if (value !== undefined && !MONEY_PATTERN.test(value))
    throw new ConflictException(`${field} 必须是非负且最多两位小数的金额字符串`);
}
function intakeConflict(code: ProductIntakeErrorCode, message: string): ConflictException {
  return new ConflictException({ code, message });
}
function setTenant(tx: Tx, tenantId: string): Promise<number> {
  return tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
}
async function recordUsage(tx: Tx, tenantId: string): Promise<void> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  await tx.usageMetric.upsert({
    where: {
      tenantId_metricKey_periodStart: { tenantId, metricKey: 'products', periodStart: start },
    },
    create: { tenantId, metricKey: 'products', amount: 1, periodStart: start, periodEnd: end },
    update: { amount: { increment: 1 } },
  });
}

async function assertProductQuota(tx: Tx, tenantId: string): Promise<void> {
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, include: { plan: true } });
  const quotas = tenant?.plan?.quotas;
  const limit =
    typeof quotas === 'object' &&
    quotas !== null &&
    !Array.isArray(quotas) &&
    typeof quotas.products === 'number'
      ? quotas.products
      : -1;
  if (
    limit >= 0 &&
    (await tx.product.count({ where: { tenantId, deletedAt: null, status: { not: 'draft' } } })) >=
      limit
  )
    throw new ConflictException(`商品数量已达套餐上限（${limit}）`);
}
async function recordEvent(
  tx: Tx,
  tenantId: string,
  actorId: string,
  productId: string,
  eventType: string,
  payload: Prisma.InputJsonValue,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId,
      actorId,
      actorType: 'merchant',
      action: eventType,
      resourceType: 'product',
      resourceId: productId,
      diff: payload,
    },
  });
  await tx.domainEventOutbox.create({
    data: { tenantId, aggregateType: 'product', aggregateId: productId, eventType, payload },
  });
}
