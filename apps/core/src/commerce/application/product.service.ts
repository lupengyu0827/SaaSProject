import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateProductRequest,
  ProductListQuery,
  ProductPageResponse,
  ProductResponse,
  ProductStatus,
  UpdateProductRequest,
  CreateProductVariantRequest,
  UpdateProductVariantRequest,
  ProductVariantResponse,
} from '@saas/contracts';

import { Prisma, type Product, type ProductVariant } from '../../generated/prisma/index.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import {
  assertCreateProduct,
  assertMoney,
  assertStatusTransition,
} from '../domain/product.rules.js';

type ProductWithVariants = Product & { variants: ProductVariant[] };

function toResponse(product: ProductWithVariants): ProductResponse {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    brandId: product.brandId,
    attributes: product.attributes,
    seoSlug: product.seoSlug,
    status: product.status as ProductStatus,
    version: product.version,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      specs: variant.specs,
      price: variant.price.toFixed(2),
      costPrice: variant.costPrice.toFixed(2),
      weightG: variant.weightG?.toFixed(2) ?? null,
    })),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    actorId: string,
    input: CreateProductRequest,
  ): Promise<ProductResponse> {
    assertCreateProduct(input);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      await this.assertRelations(tx, tenantId, input.categoryId, input.brandId);
      const product = await tx.product.create({
        data: {
          tenantId,
          code: input.code.trim(),
          name: input.name.trim(),
          description: input.description,
          categoryId: input.categoryId,
          brandId: input.brandId,
          attributes: (input.attributes ?? {}) as Prisma.InputJsonValue,
          seoSlug: input.seoSlug,
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
      return toResponse(product);
    });
  }

  async get(tenantId: string, id: string): Promise<ProductResponse> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      const product = await tx.product.findFirst({
        where: { id, tenantId },
        include: { variants: true },
      });
      if (!product) throw new NotFoundException('Product not found');
      return toResponse(product);
    });
  }

  async list(tenantId: string, query: ProductListQuery): Promise<ProductPageResponse> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      const products = await tx.product.findMany({
        where: {
          tenantId,
          status: query.status,
          OR: query.search
            ? [
                { name: { contains: query.search, mode: 'insensitive' } },
                { code: { contains: query.search, mode: 'insensitive' } },
                { variants: { some: { sku: { contains: query.search, mode: 'insensitive' } } } },
              ]
            : undefined,
        },
        include: { variants: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        cursor: query.cursor ? { id: query.cursor } : undefined,
        skip: query.cursor ? 1 : 0,
        take: limit + 1,
      });
      const hasMore = products.length > limit;
      const items = products.slice(0, limit);
      return {
        items: items.map(toResponse),
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
      };
    });
  }

  async update(
    tenantId: string,
    actorId: string,
    id: string,
    input: UpdateProductRequest,
  ): Promise<ProductResponse> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      const current = await tx.product.findFirst({ where: { id, tenantId } });
      if (!current) throw new NotFoundException('Product not found');
      if (input.status) assertStatusTransition(current.status as ProductStatus, input.status);
      await this.assertRelations(
        tx,
        tenantId,
        input.categoryId ?? undefined,
        input.brandId ?? undefined,
      );
      const result = await tx.product.updateMany({
        where: { id, tenantId, version: input.version },
        data: {
          name: input.name?.trim(),
          description: input.description,
          categoryId: input.categoryId,
          brandId: input.brandId,
          attributes: input.attributes as Prisma.InputJsonValue | undefined,
          seoSlug: input.seoSlug,
          status: input.status,
          updatedBy: actorId,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1)
        throw new ConflictException('Product was modified by another request');
      return toResponse(
        await tx.product.findFirstOrThrow({ where: { id, tenantId }, include: { variants: true } }),
      );
    });
  }

  async addVariant(
    tenantId: string,
    productId: string,
    input: CreateProductVariantRequest,
  ): Promise<ProductVariantResponse> {
    assertMoney(input.price, 'price');
    if (input.costPrice) assertMoney(input.costPrice, 'costPrice');
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      if (!(await tx.product.findFirst({ where: { id: productId, tenantId } }))) {
        throw new NotFoundException('Product not found');
      }
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
      return this.variantResponse(variant);
    });
  }

  async updateVariant(
    tenantId: string,
    variantId: string,
    input: UpdateProductVariantRequest,
  ): Promise<ProductVariantResponse> {
    if (input.price) assertMoney(input.price, 'price');
    if (input.costPrice) assertMoney(input.costPrice, 'costPrice');
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      const result = await tx.productVariant.updateMany({
        where: { id: variantId, tenantId },
        data: {
          specs: input.specs as Prisma.InputJsonValue | undefined,
          price: input.price,
          costPrice: input.costPrice,
          weightG: input.weightG,
        },
      });
      if (result.count !== 1) throw new NotFoundException('SKU not found');
      return this.variantResponse(
        await tx.productVariant.findFirstOrThrow({ where: { id: variantId, tenantId } }),
      );
    });
  }

  async deleteVariant(tenantId: string, variantId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      const variant = await tx.productVariant.findFirst({ where: { id: variantId, tenantId } });
      if (!variant) throw new NotFoundException('SKU not found');
      const count = await tx.productVariant.count({
        where: { tenantId, productId: variant.productId },
      });
      if (count <= 1) throw new ConflictException('A product must keep at least one SKU');
      await tx.productVariant.delete({ where: { id: variantId } });
    });
  }

  private variantResponse(variant: ProductVariant): ProductVariantResponse {
    return {
      id: variant.id,
      sku: variant.sku,
      specs: variant.specs,
      price: variant.price.toFixed(2),
      costPrice: variant.costPrice.toFixed(2),
      weightG: variant.weightG?.toFixed(2) ?? null,
    };
  }

  private async assertRelations(
    tx: Prisma.TransactionClient,
    tenantId: string,
    categoryId?: string,
    brandId?: string,
  ): Promise<void> {
    if (categoryId && !(await tx.category.findFirst({ where: { id: categoryId, tenantId } }))) {
      throw new NotFoundException('Category not found');
    }
    if (brandId && !(await tx.brand.findFirst({ where: { id: brandId, tenantId } }))) {
      throw new NotFoundException('Brand not found');
    }
  }
}
