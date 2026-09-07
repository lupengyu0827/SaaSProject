/** 商品应用服务：租户隔离的商品、SKU、图片和批量生命周期用例。 */
import { randomUUID } from 'node:crypto';

import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  BatchUpdateProductsRequest,
  BatchUpdateProductsResponse,
  BindProductDraftMediaRequest,
  CreateProductDraftRequest,
  CreateProductImageRequest,
  CreateProductRequest,
  CreateProductVariantRequest,
  ProductImageResponse,
  ProductLifecycleCommandRequest,
  ProductLifecycleEventResponse,
  ProductDraftListQuery,
  ProductListQuery,
  ProductPageResponse,
  ProductResponse,
  ProductStatus,
  ProductVariantResponse,
  ProductPublishIssue,
  ProductPublishValidationResponse,
  PublishProductDraftResponse,
  PublicProductListQuery,
  PublicProductPageResponse,
  PublicProductResponse,
  SaveProductDraftRequest,
  SortProductImagesRequest,
  UpdateProductRequest,
  UpdateProductVariantRequest,
} from '@saas/contracts';
import { ProductDraftErrorCode } from '@saas/contracts';
import { ProductLifecycleErrorCode } from '@saas/contracts';
import { Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import {
  assertCreateProduct,
  assertMoney,
  assertStatusTransition,
} from '../domain/product.rules.js';

type ProductRow = Prisma.ProductGetPayload<{
  include: { variants: { include: { inventoryTransactions: true } }; images: true };
}>;
const MAX_IMAGES = 12;

@Injectable()
export class ProductService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** 创建可增量保存的一物一件商品草稿。 */
  createDraft(
    tenantId: string,
    actorId: string,
    input: CreateProductDraftRequest,
  ): Promise<ProductResponse> {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
    return this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      const product = await tx.product.create({
        data: {
          tenantId,
          code: `DRAFT-${suffix}`,
          name: input.name?.trim() ?? '',
          status: 'draft',
          createdBy: actorId,
          updatedBy: actorId,
          variants: {
            create: { tenantId, sku: `SKU-${suffix}`, price: '0.00', costPrice: '0.00' },
          },
        },
      });
      await this.recordWrite(tx, tenantId, actorId, 'product.draft.created', product.id, {});
      return this.response(tx, tenantId, product.id);
    });
  }

  /** 查询当前租户未删除草稿，供商家恢复最近编辑。 */
  listDrafts(tenantId: string, query: ProductDraftListQuery): Promise<ProductPageResponse> {
    const page = Math.max(Number(query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 100);
    return this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      const where: Prisma.ProductWhereInput = {
        tenantId,
        status: 'draft',
        deletedAt: null,
        OR: query.keyword
          ? [
              { name: { contains: query.keyword, mode: 'insensitive' } },
              { code: { contains: query.keyword, mode: 'insensitive' } },
            ]
          : undefined,
      };
      const [total, rows] = await Promise.all([
        tx.product.count({ where }),
        tx.product.findMany({
          where,
          include: {
            variants: { where: { deletedAt: null }, include: { inventoryTransactions: true } },
            images: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
          },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);
      return { list: rows.map(toResponse), total, page, pageSize };
    });
  }

  /** 查询当前租户的单个未删除草稿。 */
  getDraft(tenantId: string, id: string): Promise<ProductResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      return this.draftResponse(tx, tenantId, id);
    });
  }

  /** 软删除草稿并解除媒体占用，保留审计与领域事件。 */
  deleteDraft(tenantId: string, actorId: string, id: string, version: number): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      const current = await tx.product.findFirst({
        where: { id, tenantId, status: 'draft', deletedAt: null },
        select: { version: true },
      });
      if (!current) throw new NotFoundException('商品草稿不存在');
      if (current.version !== version) throw draftVersionConflict(current.version);
      const deletedAt = new Date();
      const images = await tx.productImage.findMany({
        where: { tenantId, productId: id, deletedAt: null },
        select: { mediaAssetId: true },
      });
      const changed = await tx.product.updateMany({
        where: { id, tenantId, status: 'draft', deletedAt: null, version },
        data: { status: 'archived', deletedAt, updatedBy: actorId, version: { increment: 1 } },
      });
      if (changed.count !== 1) await this.throwDraftVersionConflict(tx, tenantId, id);
      await tx.productImage.updateMany({
        where: { tenantId, productId: id, deletedAt: null },
        data: { mediaAssetId: null, isPrimary: false, deletedAt },
      });
      const assetIds = images.flatMap(({ mediaAssetId }) => (mediaAssetId ? [mediaAssetId] : []));
      if (assetIds.length)
        await tx.mediaAsset.updateMany({
          where: { id: { in: assetIds }, tenantId, status: 'attached' },
          data: { status: 'temporary' },
        });
      await this.recordWrite(tx, tenantId, actorId, 'product.draft.deleted', id, { version });
    });
  }

  /** 复制草稿资料和默认规格；媒体资源因唯一绑定约束不复制。 */
  duplicateDraft(
    tenantId: string,
    actorId: string,
    id: string,
    version: number,
  ): Promise<ProductResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      const source = await tx.product.findFirst({
        where: { id, tenantId, status: 'draft', deletedAt: null },
        include: { variants: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } } },
      });
      if (!source) throw new NotFoundException('商品草稿不存在');
      if (source.version !== version) throw draftVersionConflict(source.version);
      const sourceVariant = source.variants[0];
      if (!sourceVariant) throw new ConflictException('草稿缺少默认规格');
      const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
      const copy = await tx.product.create({
        data: {
          tenantId,
          code: `DRAFT-${suffix}`,
          name: source.name,
          description: source.description,
          categoryId: source.categoryId,
          brandId: source.brandId,
          attributes: source.attributes as Prisma.InputJsonValue,
          status: 'draft',
          createdBy: actorId,
          updatedBy: actorId,
          variants: {
            create: {
              tenantId,
              sku: `SKU-${suffix}`,
              specs: sourceVariant.specs as Prisma.InputJsonValue,
              price: sourceVariant.price,
              costPrice: sourceVariant.costPrice,
              weightG: sourceVariant.weightG,
            },
          },
        },
      });
      await this.recordWrite(tx, tenantId, actorId, 'product.draft.duplicated', copy.id, {
        sourceProductId: id,
        sourceVersion: version,
      });
      return this.draftResponse(tx, tenantId, copy.id);
    });
  }

  /** 乐观锁增量保存草稿；未提交字段继续保留原值。 */
  saveDraft(
    tenantId: string,
    actorId: string,
    id: string,
    input: SaveProductDraftRequest,
  ): Promise<ProductResponse> {
    if (input.price !== undefined) assertMoney(input.price, 'price');
    return this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      const current = await tx.product.findFirst({
        where: { id, tenantId, status: 'draft', deletedAt: null },
      });
      if (!current) throw new NotFoundException('商品草稿不存在');
      await this.assertRelations(
        tx,
        tenantId,
        input.categoryId ?? undefined,
        input.brandId ?? undefined,
      );
      const updated = await tx.product.updateMany({
        where: { id, tenantId, status: 'draft', deletedAt: null, version: input.version },
        data: {
          name: input.name?.trim(),
          description: input.description === null ? null : input.description?.trim(),
          categoryId: input.categoryId,
          brandId: input.brandId,
          attributes: mergeDraftAttributes(current.attributes, input),
          updatedBy: actorId,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) await this.throwDraftVersionConflict(tx, tenantId, id);
      if (input.price !== undefined) {
        const variant = await tx.productVariant.findFirst({
          where: { tenantId, productId: id, deletedAt: null },
          orderBy: { createdAt: 'asc' },
        });
        if (!variant) throw new ConflictException('草稿缺少默认规格');
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { price: input.price, version: { increment: 1 } },
        });
      }
      await this.recordWrite(tx, tenantId, actorId, 'product.draft.saved', id, {
        fields: Object.keys(input),
      });
      return this.response(tx, tenantId, id);
    });
  }

  /** 将同租户已确认媒体绑定到草稿，禁止任意外部 URL。 */
  bindDraftMedia(
    tenantId: string,
    actorId: string,
    id: string,
    input: BindProductDraftMediaRequest,
  ): Promise<ProductResponse> {
    const assetIds = [...new Set(input.assetIds)];
    if (
      !assetIds.length ||
      assetIds.length > MAX_IMAGES ||
      !assetIds.includes(input.primaryAssetId)
    ) {
      throw new ConflictException('草稿图片数量或主图设置无效');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      const product = await tx.product.findFirst({
        where: { id, tenantId, status: 'draft', deletedAt: null },
      });
      if (!product) throw new NotFoundException('商品草稿不存在');
      const assets = await tx.mediaAsset.findMany({
        where: {
          id: { in: assetIds },
          tenantId,
          purpose: 'product',
          status: { in: ['temporary', 'attached'] },
          deletedAt: null,
        },
        include: { productImage: true },
      });
      if (
        assets.length !== assetIds.length ||
        assets.some(({ productImage }) => productImage && productImage.productId !== id)
      ) {
        throw new ConflictException('包含不可绑定或属于其他商品的媒体资源');
      }
      const changed = await tx.product.updateMany({
        where: { id, tenantId, status: 'draft', version: input.version },
        data: { updatedBy: actorId, version: { increment: 1 } },
      });
      if (changed.count !== 1) await this.throwDraftVersionConflict(tx, tenantId, id);
      const previous = await tx.productImage.findMany({
        where: { tenantId, productId: id, deletedAt: null },
        select: { mediaAssetId: true },
      });
      const previousAssetIds = previous.flatMap(({ mediaAssetId }) =>
        mediaAssetId ? [mediaAssetId] : [],
      );
      await tx.productImage.updateMany({
        where: { tenantId, productId: id, deletedAt: null },
        data: { mediaAssetId: null, deletedAt: new Date(), isPrimary: false },
      });
      for (const [sortOrder, assetId] of assetIds.entries()) {
        const asset = assets.find(({ id: currentId }) => currentId === assetId);
        if (!asset) throw new ConflictException('媒体资源不存在');
        await tx.productImage.create({
          data: {
            tenantId,
            productId: id,
            mediaAssetId: asset.id,
            url: `/api/media/public/assets/${asset.id}/content?tenantId=${encodeURIComponent(tenantId)}`,
            altText: product.name || null,
            sortOrder,
            isPrimary: asset.id === input.primaryAssetId,
            sizeBytes: asset.sizeBytes,
            mimeType: asset.mimeType,
          },
        });
      }
      await tx.mediaAsset.updateMany({
        where: { id: { in: assetIds }, tenantId },
        data: { status: 'attached' },
      });
      const detached = previousAssetIds.filter((assetId) => !assetIds.includes(assetId));
      if (detached.length)
        await tx.mediaAsset.updateMany({
          where: { id: { in: detached }, tenantId, status: 'attached' },
          data: { status: 'temporary' },
        });
      await this.recordWrite(tx, tenantId, actorId, 'product.draft.media_bound', id, {
        assetIds,
        primaryAssetId: input.primaryAssetId,
      });
      return this.response(tx, tenantId, id);
    });
  }

  /** 返回发布校验问题，不改变草稿。 */
  async validateDraftPublish(
    tenantId: string,
    id: string,
  ): Promise<ProductPublishValidationResponse> {
    const product = await this.get(tenantId, id);
    if (product.status !== 'draft') throw new ConflictException('只有草稿可以执行发布校验');
    const issues = publishIssues(product);
    return { valid: issues.length === 0, issues };
  }

  /** 原子发布草稿：配额、默认库存、状态、用量、审计和事件同事务完成。 */
  publishDraft(
    tenantId: string,
    actorId: string,
    id: string,
    version: number,
  ): Promise<PublishProductDraftResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      const product = await this.response(tx, tenantId, id);
      if (product.status === 'active' && [product.version, product.version - 1].includes(version)) {
        return { product, publishedAt: product.updatedAt };
      }
      if (product.status !== 'draft') throw new ConflictException('只有草稿可以发布');
      if (product.version !== version) throw draftVersionConflict(product.version);
      const issues = publishIssues(product);
      if (issues.length)
        throw new ConflictException({ message: '商品资料尚未满足发布要求', issues });
      await this.assertProductQuota(tx, tenantId);
      const variant = await tx.productVariant.findFirst({
        where: { tenantId, productId: id, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: { inventoryTransactions: true },
      });
      if (!variant) throw new ConflictException('草稿缺少默认规格');
      if (sumStock(variant.inventoryTransactions) === 0)
        await this.initialStock(tx, tenantId, actorId, variant.id, 1);
      const changed = await tx.product.updateMany({
        where: { id, tenantId, status: 'draft', version },
        data: { status: 'active', updatedBy: actorId, version: { increment: 1 } },
      });
      if (changed.count !== 1) await this.throwDraftVersionConflict(tx, tenantId, id);
      await this.recordUsage(tx, tenantId, 'products', 1);
      await this.recordWrite(tx, tenantId, actorId, 'product.published', id, {
        source: 'merchant_miniapp',
        fromStatus: 'draft',
        toStatus: 'active',
        reason: '商品发布',
      });
      return {
        product: await this.response(tx, tenantId, id),
        publishedAt: new Date().toISOString(),
      };
    });
  }

  async create(
    tenantId: string,
    actorId: string,
    input: CreateProductRequest,
  ): Promise<ProductResponse> {
    assertCreateProduct(input);
    return this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      await this.assertProductQuota(tx, tenantId);
      await this.assertRelations(tx, tenantId, input.categoryId, input.brandId);
      const product = await tx.product.create({
        data: {
          tenantId,
          code: input.code.trim(),
          name: input.name.trim(),
          description: input.description?.trim() || null,
          categoryId: input.categoryId,
          brandId: input.brandId,
          attributes: (input.attributes ?? {}) as Prisma.InputJsonValue,
          seoSlug: input.seoSlug?.trim() || null,
          createdBy: actorId,
          updatedBy: actorId,
          variants: {
            create: input.variants.map((variant) => ({
              tenantId,
              sku: variant.sku.trim(),
              specs: (variant.specs ?? {}) as Prisma.InputJsonValue,
              price: variant.price,
              costPrice: variant.costPrice ?? '0',
              weightG: variant.weightG,
            })),
          },
        },
        include: { variants: true },
      });
      for (const [index, variant] of product.variants.entries()) {
        const quantity = input.variants[index]?.initialStock ?? 0;
        if (quantity > 0) await this.initialStock(tx, tenantId, actorId, variant.id, quantity);
      }
      await this.recordUsage(tx, tenantId, 'products', 1);
      await this.recordWrite(tx, tenantId, actorId, 'product.created', product.id, {
        code: product.code,
      });
      return this.response(tx, tenantId, product.id);
    });
  }

  get(tenantId: string, id: string): Promise<ProductResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      return this.response(tx, tenantId, id, true);
    });
  }

  list(tenantId: string, query: ProductListQuery): Promise<ProductPageResponse> {
    const page = Math.max(Number(query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 100);
    return this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      const where: Prisma.ProductWhereInput = {
        tenantId,
        deletedAt: query.includeDeleted ? undefined : null,
        status: query.status,
        categoryId: query.categoryId,
        brandId: query.brandId,
        OR: query.keyword
          ? [
              { name: { contains: query.keyword, mode: 'insensitive' } },
              { code: { contains: query.keyword, mode: 'insensitive' } },
              {
                variants: {
                  some: { sku: { contains: query.keyword, mode: 'insensitive' }, deletedAt: null },
                },
              },
            ]
          : undefined,
      };
      const orderBy = this.orderBy(query);
      const [total, rows] = await Promise.all([
        tx.product.count({ where }),
        tx.product.findMany({
          where,
          include: {
            variants: { where: { deletedAt: null }, include: { inventoryTransactions: true } },
            images: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
          },
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);
      let list = rows.map(toResponse);
      if (query.stockState)
        list = list.filter((item) => stockMatches(item.availableStockQty, query.stockState!));
      if (query.sortBy === 'price' || query.sortBy === 'stock') {
        const sign = query.sortOrder === 'asc' ? 1 : -1;
        list.sort(
          (a, b) =>
            sign *
            (query.sortBy === 'price'
              ? Number(a.minimumPrice) - Number(b.minimumPrice)
              : a.availableStockQty - b.availableStockQty),
        );
      }
      return { list, total: query.stockState ? list.length : total, page, pageSize };
    });
  }

  /** 查询消费者可见的在售商品，并转换为公开字段白名单。 */
  async listPublic(
    tenantId: string,
    query: PublicProductListQuery,
  ): Promise<PublicProductPageResponse> {
    const page = await this.list(tenantId, { ...query, status: 'active' });
    const media = await this.publicDetailMedia(
      tenantId,
      page.list.map(({ id }) => id),
    );
    return {
      ...page,
      list: page.list.map((product) => ({
        ...toPublicProductResponse(product),
        detailMedia: media.get(product.id) ?? [],
      })),
    };
  }

  /** 查询消费者可见的单个在售商品。 */
  async getPublic(tenantId: string, id: string): Promise<PublicProductResponse> {
    const product = await this.get(tenantId, id);
    if (product.deletedAt) throw new NotFoundException('藏品不存在');
    if (product.status === 'archived')
      throw new NotFoundException({
        code: ProductLifecycleErrorCode.PUBLIC_UNLISTED,
        message: '商品已下架',
        data: { availability: 'unlisted' },
      });
    if (product.status === 'sold')
      throw new NotFoundException({
        code: ProductLifecycleErrorCode.PUBLIC_SOLD,
        message: '商品已售',
        data: { availability: 'sold' },
      });
    if (product.status !== 'active') throw new NotFoundException('藏品不存在');
    const media = await this.publicDetailMedia(tenantId, [product.id]);
    return { ...toPublicProductResponse(product), detailMedia: media.get(product.id) ?? [] };
  }

  private async publicDetailMedia(
    tenantId: string,
    productIds: string[],
  ): Promise<Map<string, PublicProductResponse['detailMedia']>> {
    if (!productIds.length) return new Map();
    return this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      const rows = await tx.productIntakeMedia.findMany({
        where: {
          tenantId,
          visibility: 'public',
          intake: { productId: { in: productIds }, product: { status: 'active', deletedAt: null } },
        },
        include: { mediaAsset: true, intake: { select: { productId: true } } },
        orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }],
      });
      const result = new Map<string, PublicProductResponse['detailMedia']>();
      for (const row of rows) {
        const list = result.get(row.intake.productId) ?? [];
        list.push({
          assetId: row.mediaAssetId,
          type: row.group === 'detail_video' ? 'video' : 'image',
          url: `/api/media/public/assets/${row.mediaAssetId}/content?tenantId=${encodeURIComponent(tenantId)}`,
          mimeType: row.mediaAsset.mimeType,
          sortOrder: row.sortOrder,
          durationSeconds: row.durationSeconds,
        });
        result.set(row.intake.productId, list);
      }
      return result;
    });
  }

  /** 商家下架在售商品；相同命令重试不重复写审计和事件。 */
  unlist(
    tenantId: string,
    actorId: string,
    id: string,
    input: ProductLifecycleCommandRequest,
  ): Promise<ProductResponse> {
    return this.transitionLifecycle(tenantId, actorId, id, input, 'active', 'archived');
  }

  /** 商家重新上架商品；库存必须大于零。 */
  relist(
    tenantId: string,
    actorId: string,
    id: string,
    input: ProductLifecycleCommandRequest,
  ): Promise<ProductResponse> {
    return this.transitionLifecycle(tenantId, actorId, id, input, 'archived', 'active');
  }

  /** 查询当前租户商品的发布、上下架和已售轨迹。 */
  listLifecycleEvents(tenantId: string, id: string): Promise<ProductLifecycleEventResponse[]> {
    return this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      if (!(await tx.product.findFirst({ where: { id, tenantId } })))
        throw new NotFoundException('商品不存在');
      const rows = await tx.auditLog.findMany({
        where: {
          tenantId,
          resourceType: 'product',
          resourceId: id,
          action: {
            in: ['product.published', 'product.unlisted', 'product.relisted', 'product.sold'],
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      return rows.map(toLifecycleEventResponse);
    });
  }

  update(
    tenantId: string,
    actorId: string,
    id: string,
    input: UpdateProductRequest,
  ): Promise<ProductResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      const current = await tx.product.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!current) throw new NotFoundException('商品不存在');
      if (input.status) throw lifecycleBypassConflict();
      await this.assertRelations(
        tx,
        tenantId,
        input.categoryId ?? undefined,
        input.brandId ?? undefined,
      );
      const result = await tx.product.updateMany({
        where: { id, tenantId, deletedAt: null, version: input.version },
        data: {
          name: input.name?.trim(),
          description: input.description?.trim(),
          categoryId: input.categoryId,
          brandId: input.brandId,
          attributes: input.attributes as Prisma.InputJsonValue | undefined,
          seoSlug: input.seoSlug?.trim(),
          updatedBy: actorId,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictException('商品已被其他操作修改，请刷新重试');
      await this.recordWrite(tx, tenantId, actorId, 'product.updated', id, input);
      return this.response(tx, tenantId, id);
    });
  }

  batchUpdate(
    tenantId: string,
    actorId: string,
    input: BatchUpdateProductsRequest,
  ): Promise<BatchUpdateProductsResponse> {
    const ids = [...new Set(input.ids)].slice(0, 100);
    if (!ids.length) throw new ConflictException('请选择商品');
    if (input.action === 'activate' || input.action === 'archive') throw lifecycleBypassConflict();
    return this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      if ((await tx.product.count({ where: { id: { in: ids }, tenantId } })) !== ids.length)
        throw new NotFoundException('部分商品不存在');
      const data: Prisma.ProductUpdateManyMutationInput =
        input.action === 'restore'
          ? { deletedAt: null, status: 'draft', updatedBy: actorId, version: { increment: 1 } }
          : {
              deletedAt: new Date(),
              status: 'archived',
              updatedBy: actorId,
              version: { increment: 1 },
            };
      const result = await tx.product.updateMany({ where: { id: { in: ids }, tenantId }, data });
      await this.recordWrite(
        tx,
        tenantId,
        actorId,
        `product.batch.${input.action}`,
        ids.join(','),
        { ids },
      );
      return { affected: result.count };
    });
  }

  addVariant(
    tenantId: string,
    actorId: string,
    productId: string,
    input: CreateProductVariantRequest,
  ): Promise<ProductVariantResponse> {
    assertVariant(input);
    return this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      if (!(await tx.product.findFirst({ where: { id: productId, tenantId, deletedAt: null } })))
        throw new NotFoundException('商品不存在');
      const variant = await tx.productVariant.create({
        data: {
          tenantId,
          productId,
          sku: input.sku.trim(),
          specs: (input.specs ?? {}) as Prisma.InputJsonValue,
          price: input.price,
          costPrice: input.costPrice ?? '0',
          weightG: input.weightG,
        },
      });
      if ((input.initialStock ?? 0) > 0)
        await this.initialStock(tx, tenantId, actorId, variant.id, input.initialStock!);
      await this.recordWrite(tx, tenantId, actorId, 'product.variant.created', variant.id, {
        productId,
        sku: variant.sku,
      });
      return this.variant(tx, tenantId, variant.id);
    });
  }

  updateVariant(
    tenantId: string,
    variantId: string,
    input: UpdateProductVariantRequest,
  ): Promise<ProductVariantResponse> {
    if (input.price !== undefined) assertMoney(input.price, 'price');
    if (input.costPrice !== undefined) assertMoney(input.costPrice, 'costPrice');
    return this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      const result = await tx.productVariant.updateMany({
        where: { id: variantId, tenantId, deletedAt: null, version: input.version },
        data: {
          specs: input.specs as Prisma.InputJsonValue | undefined,
          price: input.price,
          costPrice: input.costPrice,
          weightG: input.weightG,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictException('SKU 不存在或已被修改');
      return this.variant(tx, tenantId, variantId);
    });
  }

  async deleteVariant(tenantId: string, variantId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      const variant = await tx.productVariant.findFirst({
        where: { id: variantId, tenantId, deletedAt: null },
        include: { orderItems: true, inventoryTransactions: true },
      });
      if (!variant) throw new NotFoundException('SKU 不存在');
      if (variant.orderItems.length || sumStock(variant.inventoryTransactions) !== 0)
        throw new ConflictException('SKU 已有订单或库存，请先清零库存');
      if (
        (await tx.productVariant.count({
          where: { tenantId, productId: variant.productId, deletedAt: null },
        })) <= 1
      )
        throw new ConflictException('商品必须保留至少一个 SKU');
      await tx.productVariant.update({
        where: { id: variantId },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
    });
  }

  addImage(
    tenantId: string,
    productId: string,
    input: CreateProductImageRequest,
  ): Promise<ProductImageResponse> {
    if (input.sizeBytes <= 0 || input.sizeBytes > 10 * 1024 * 1024)
      throw new ConflictException('图片不能超过 10MB');
    return this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      if (!(await tx.product.findFirst({ where: { id: productId, tenantId, deletedAt: null } })))
        throw new NotFoundException('商品不存在');
      const count = await tx.productImage.count({
        where: { productId, tenantId, deletedAt: null },
      });
      if (count >= MAX_IMAGES) throw new ConflictException(`最多上传 ${MAX_IMAGES} 张图片`);
      const row = await tx.productImage.create({
        data: { tenantId, productId, ...input, sortOrder: count, isPrimary: count === 0 },
      });
      return imageResponse(row);
    });
  }

  async sortImages(
    tenantId: string,
    productId: string,
    input: SortProductImagesRequest,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      const rows = await tx.productImage.findMany({
        where: { tenantId, productId, deletedAt: null },
        select: { id: true },
      });
      const owned = new Set(rows.map(({ id }) => id));
      if (
        owned.size !== input.imageIds.length ||
        input.imageIds.some((id) => !owned.has(id)) ||
        !owned.has(input.primaryImageId)
      )
        throw new ConflictException('图片排序数据不完整');
      for (const [sortOrder, id] of input.imageIds.entries())
        await tx.productImage.updateMany({
          where: { id, tenantId, productId },
          data: { sortOrder, isPrimary: id === input.primaryImageId, version: { increment: 1 } },
        });
    });
  }

  async deleteImage(tenantId: string, productId: string, imageId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      const image = await tx.productImage.findFirst({
        where: { id: imageId, productId, tenantId, deletedAt: null },
      });
      if (!image) throw new NotFoundException('图片不存在');
      await tx.productImage.update({
        where: { id: imageId },
        data: { deletedAt: new Date(), isPrimary: false, version: { increment: 1 } },
      });
      if (image.isPrimary) {
        const next = await tx.productImage.findFirst({
          where: { productId, tenantId, deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        });
        if (next)
          await tx.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
    });
  }

  private transitionLifecycle(
    tenantId: string,
    actorId: string,
    id: string,
    input: ProductLifecycleCommandRequest,
    expected: ProductStatus,
    target: ProductStatus,
  ): Promise<ProductResponse> {
    const reason = input.reason.trim();
    if (reason.length < 2) {
      throw new ConflictException({
        code: ProductLifecycleErrorCode.VALIDATION_FAILED,
        message: '请填写至少 2 个字符的操作原因',
        data: null,
      });
    }
    return this.prisma.$transaction(async (tx) => {
      await this.tenant(tx, tenantId);
      const product = await this.response(tx, tenantId, id);
      if (
        product.status === target &&
        [product.version, product.version - 1].includes(input.version)
      )
        return product;
      if (product.status !== expected) {
        throw new ConflictException({
          code: ProductLifecycleErrorCode.INVALID_TRANSITION,
          message: `商品当前状态为 ${product.status}，不能执行此操作`,
          data: { currentStatus: product.status },
        });
      }
      if (product.version !== input.version) throw draftVersionConflict(product.version);
      assertStatusTransition(product.status, target);
      if (target === 'active') {
        const issues = publishIssues(product);
        if (issues.length) {
          throw new ConflictException({
            code: ProductLifecycleErrorCode.VALIDATION_FAILED,
            message: '商品资料不完整，不能重新上架',
            data: { issues },
          });
        }
      }
      if (target === 'active' && product.availableStockQty <= 0) {
        throw new ConflictException({
          code: ProductLifecycleErrorCode.INSUFFICIENT_STOCK,
          message: '商品可售库存不足，不能重新上架',
          data: { availableStockQty: product.availableStockQty },
        });
      }
      const changed = await tx.product.updateMany({
        where: { id, tenantId, status: expected, deletedAt: null, version: input.version },
        data: { status: target, updatedBy: actorId, version: { increment: 1 } },
      });
      if (changed.count !== 1) await this.throwDraftVersionConflict(tx, tenantId, id);
      const event = target === 'active' ? 'relisted' : 'unlisted';
      await this.recordWrite(tx, tenantId, actorId, `product.${event}`, id, {
        fromStatus: expected,
        toStatus: target,
        reason,
      });
      return this.response(tx, tenantId, id);
    });
  }

  private response(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
    includeDeleted = false,
  ): Promise<ProductResponse> {
    return tx.product
      .findFirst({
        where: { id, tenantId, deletedAt: includeDeleted ? undefined : null },
        include: {
          variants: {
            where: { deletedAt: null },
            include: { inventoryTransactions: true },
            orderBy: { createdAt: 'asc' },
          },
          images: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
        },
      })
      .then((row) => {
        if (!row) throw new NotFoundException('商品不存在');
        return toResponse(row);
      });
  }
  private draftResponse(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ): Promise<ProductResponse> {
    return tx.product
      .findFirst({
        where: { id, tenantId, status: 'draft', deletedAt: null },
        include: {
          variants: {
            where: { deletedAt: null },
            include: { inventoryTransactions: true },
            orderBy: { createdAt: 'asc' },
          },
          images: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
        },
      })
      .then((row) => {
        if (!row) throw new NotFoundException('商品草稿不存在');
        return toResponse(row);
      });
  }
  private async throwDraftVersionConflict(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ): Promise<never> {
    const latest = await tx.product.findFirst({
      where: { id, tenantId },
      select: { version: true },
    });
    throw draftVersionConflict(latest?.version ?? -1);
  }
  private variant(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ): Promise<ProductVariantResponse> {
    return tx.productVariant
      .findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { inventoryTransactions: true },
      })
      .then((row) => {
        if (!row) throw new NotFoundException('SKU 不存在');
        return variantResponse(row);
      });
  }
  private initialStock(
    tx: Prisma.TransactionClient,
    tenantId: string,
    actorId: string,
    variantId: string,
    quantity: number,
  ): Promise<unknown> {
    if (!Number.isSafeInteger(quantity) || quantity < 0)
      throw new ConflictException('期初库存必须为非负整数');
    return tx.inventoryTransaction.create({
      data: {
        tenantId,
        variantId,
        type: 'inbound',
        qtyChange: quantity,
        referenceType: 'product_initial_stock',
        referenceId: crypto.randomUUID(),
        reason: '商品期初库存',
        operatorId: actorId,
      },
    });
  }
  private async assertRelations(
    tx: Prisma.TransactionClient,
    tenantId: string,
    categoryId?: string,
    brandId?: string,
  ): Promise<void> {
    if (
      categoryId &&
      !(await tx.category.findFirst({
        where: { id: categoryId, tenantId, status: 'active', deletedAt: null },
      }))
    )
      throw new NotFoundException('分类不存在或已停用');
    if (
      brandId &&
      !(await tx.brand.findFirst({
        where: { id: brandId, tenantId, status: 'active', deletedAt: null },
      }))
    )
      throw new NotFoundException('品牌不存在或已停用');
  }
  private async assertProductQuota(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
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
      (await tx.product.count({
        where: { tenantId, deletedAt: null, status: { not: 'draft' } },
      })) >= limit
    )
      throw new ConflictException(`商品数量已达套餐上限（${limit}），请升级套餐或清理商品`);
  }
  private recordUsage(
    tx: Prisma.TransactionClient,
    tenantId: string,
    metricKey: string,
    amount: number,
  ): Promise<unknown> {
    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
    periodEnd.setUTCDate(0);
    return tx.usageMetric.upsert({
      where: { tenantId_metricKey_periodStart: { tenantId, metricKey, periodStart } },
      create: { tenantId, metricKey, amount, periodStart, periodEnd },
      update: { amount: { increment: amount } },
    });
  }
  private async recordWrite(
    tx: Prisma.TransactionClient,
    tenantId: string,
    actorId: string,
    eventType: string,
    aggregateId: string,
    payload: unknown,
  ): Promise<void> {
    const json = payload as Prisma.InputJsonValue;
    await tx.auditLog.create({
      data: {
        tenantId,
        actorId,
        actorType: 'admin',
        action: eventType,
        resourceType: 'product',
        resourceId: aggregateId,
        diff: json,
      },
    });
    await tx.domainEventOutbox.create({
      data: { tenantId, aggregateType: 'product', aggregateId, eventType, payload: json },
    });
  }
  private orderBy(query: ProductListQuery): Prisma.ProductOrderByWithRelationInput[] {
    const order = query.sortOrder ?? 'desc';
    if (query.sortBy === 'name') return [{ name: order }, { id: 'desc' }];
    if (query.sortBy === 'updatedAt') return [{ updatedAt: order }, { id: 'desc' }];
    return [{ createdAt: order }, { id: 'desc' }];
  }
  private tenant(tx: Prisma.TransactionClient, tenantId: string): Promise<number> {
    return tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
  }
}

function toResponse(row: ProductRow): ProductResponse {
  const variants = row.variants.map(variantResponse);
  const prices = variants.map(({ price }) => Number(price));
  const images = row.images.map(imageResponse);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    categoryId: row.categoryId,
    brandId: row.brandId,
    attributes: row.attributes as ProductResponse['attributes'],
    seoSlug: row.seoSlug,
    status: row.status as ProductStatus,
    version: row.version,
    variants,
    images,
    primaryImage: images.find(({ isPrimary }) => isPrimary)?.url ?? images[0]?.url ?? null,
    stockQty: variants.reduce((sum, item) => sum + item.stockQty, 0),
    availableStockQty: variants.reduce((sum, item) => sum + item.availableStockQty, 0),
    minimumPrice: prices.length ? Math.min(...prices).toFixed(2) : '0.00',
    maximumPrice: prices.length ? Math.max(...prices).toFixed(2) : '0.00',
    deletedAt: row.deletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
function variantResponse(row: ProductRow['variants'][number]): ProductVariantResponse {
  const stock = sumStock(row.inventoryTransactions);
  return {
    id: row.id,
    sku: row.sku,
    specs: row.specs,
    price: row.price.toFixed(2),
    costPrice: row.costPrice.toFixed(2),
    weightG: row.weightG?.toFixed(2) ?? null,
    version: row.version,
    stockQty: stock,
    availableStockQty: stock,
  };
}
function imageResponse(row: ProductRow['images'][number]): ProductImageResponse {
  return {
    id: row.id,
    url: row.url,
    altText: row.altText,
    sortOrder: row.sortOrder,
    isPrimary: row.isPrimary,
    sizeBytes: row.sizeBytes,
    mimeType: row.mimeType,
  };
}
function sumStock(rows: Array<{ qtyChange: number }>): number {
  return rows.reduce((sum, row) => sum + row.qtyChange, 0);
}
function stockMatches(stock: number, state: NonNullable<ProductListQuery['stockState']>): boolean {
  return state === 'out_of_stock'
    ? stock <= 0
    : state === 'low_stock'
      ? stock > 0 && stock <= 5
      : stock > 5;
}
function assertVariant(input: CreateProductVariantRequest): void {
  if (!input.sku.trim()) throw new ConflictException('SKU 编码不能为空');
  assertMoney(input.price, 'price');
  if (input.costPrice) assertMoney(input.costPrice, 'costPrice');
  if (!Number.isSafeInteger(input.initialStock ?? 0) || (input.initialStock ?? 0) < 0)
    throw new ConflictException('期初库存必须为非负整数');
}

/** 构造前后端可稳定识别的草稿乐观锁冲突。 */
function draftVersionConflict(currentVersion: number): ConflictException {
  return new ConflictException({
    code: ProductDraftErrorCode.VERSION_CONFLICT,
    message: '草稿已在其他设备修改，请刷新后重试',
    data: { currentVersion },
  });
}

function lifecycleBypassConflict(): ConflictException {
  return new ConflictException({
    code: ProductLifecycleErrorCode.INVALID_TRANSITION,
    message: '商品状态必须通过发布、上架或下架专用接口修改',
    data: null,
  });
}

function toLifecycleEventResponse(row: {
  id: bigint;
  action: string;
  actorId: string | null;
  diff: Prisma.JsonValue | null;
  createdAt: Date;
}): ProductLifecycleEventResponse {
  const diff =
    typeof row.diff === 'object' && row.diff !== null && !Array.isArray(row.diff) ? row.diff : {};
  const actionType = row.action.replace('product.', '');
  return {
    id: row.id.toString(),
    type: actionType as ProductLifecycleEventResponse['type'],
    fromStatus: typeof diff.fromStatus === 'string' ? (diff.fromStatus as ProductStatus) : null,
    toStatus:
      typeof diff.toStatus === 'string'
        ? (diff.toStatus as ProductStatus)
        : row.action === 'product.published'
          ? 'active'
          : 'sold',
    reason: typeof diff.reason === 'string' ? diff.reason : null,
    actorId: row.actorId,
    occurredAt: row.createdAt.toISOString(),
  };
}

/** 将商家商品模型转换为消费者字段白名单。 */
export function toPublicProductResponse(product: ProductResponse): PublicProductResponse {
  const attributes = product.attributes;
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    brandId: product.brandId,
    attributes: {
      usageCondition: attributes.usageCondition,
      conditionGrade: attributes.conditionGrade,
      authenticityStatus: attributes.authenticityStatus,
      material: attributes.material,
      color: attributes.color,
      year: attributes.year,
      origin: attributes.origin,
      accessories: attributes.accessories,
      appraisalOrganization: attributes.appraisalOrganization,
      appraisalCertificateNo: attributes.appraisalCertificateNo,
      size: typeof attributes.size === 'string' ? attributes.size : undefined,
      customTips: typeof attributes.customTips === 'string' ? attributes.customTips : undefined,
      audience: typeof attributes.audience === 'string' ? attributes.audience : undefined,
      warrantyCard:
        attributes.warrantyCard === 'present' || attributes.warrantyCard === 'absent'
          ? attributes.warrantyCard
          : undefined,
      warrantyCardYear:
        typeof attributes.warrantyCardYear === 'number' ? attributes.warrantyCardYear : undefined,
      seriesId: typeof attributes.seriesId === 'string' ? attributes.seriesId : undefined,
      seriesName: typeof attributes.seriesName === 'string' ? attributes.seriesName : undefined,
      modelId: typeof attributes.modelId === 'string' ? attributes.modelId : undefined,
      modelName: typeof attributes.modelName === 'string' ? attributes.modelName : undefined,
      officialGuidePrice:
        typeof attributes.officialGuidePrice === 'string'
          ? attributes.officialGuidePrice
          : undefined,
      tags: Array.isArray(attributes.tags)
        ? attributes.tags.filter((item): item is string => typeof item === 'string')
        : undefined,
    },
    variants: product.variants.map(({ id, specs, price, availableStockQty }) => ({
      id,
      specs,
      price,
      availableStockQty,
    })),
    images: product.images,
    detailMedia: [],
    primaryImage: product.primaryImage,
    availableStockQty: product.availableStockQty,
    minimumPrice: product.minimumPrice,
    maximumPrice: product.maximumPrice,
    createdAt: product.createdAt,
  };
}

function mergeDraftAttributes(
  current: Prisma.JsonValue,
  input: SaveProductDraftRequest,
): Prisma.InputJsonObject {
  const base = (
    typeof current === 'object' && current !== null && !Array.isArray(current) ? { ...current } : {}
  ) as Record<string, Prisma.InputJsonValue | null>;
  const changes: Array<[keyof SaveProductDraftRequest, string]> = [
    ['conditionGrade', 'conditionGrade'],
    ['authenticityStatus', 'authenticityStatus'],
    ['material', 'material'],
    ['color', 'color'],
    ['year', 'year'],
    ['origin', 'origin'],
    ['accessories', 'accessories'],
    ['appraisalOrganization', 'appraisalOrganization'],
    ['appraisalCertificateNo', 'appraisalCertificateNo'],
  ];
  for (const [inputKey, attributeKey] of changes) {
    const value = input[inputKey];
    if (value !== undefined) base[attributeKey] = value;
  }
  return base;
}

function publishIssues(product: ProductResponse): ProductPublishIssue[] {
  const issues: ProductPublishIssue[] = [];
  if (!product.name.trim()) issues.push({ field: 'name', message: '请填写商品名称' });
  if (!product.categoryId) issues.push({ field: 'categoryId', message: '请选择商品分类' });
  if (!product.variants.length || product.variants.every(({ price }) => Number(price) <= 0)) {
    issues.push({ field: 'price', message: '请填写大于 0 的销售价格' });
  }
  if (!product.attributes.conditionGrade)
    issues.push({ field: 'conditionGrade', message: '请选择商品成色' });
  if (!product.images.length) issues.push({ field: 'images', message: '请至少绑定一张商品图片' });
  return issues;
}
