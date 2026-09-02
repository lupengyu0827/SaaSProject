import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  BrandResponse,
  CategoryResponse,
  CreateBrandRequest,
  CreateCategoryRequest,
  UpdateBrandRequest,
  UpdateCategoryRequest,
  CatalogItemStatus,
} from '@saas/contracts';

import type { Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class CatalogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  createCategory(
    tenantId: string,
    input: CreateCategoryRequest,
  ): Promise<CategoryResponse> {
    this.assertName(input.name);
    if (input.sortOrder !== undefined && (!Number.isSafeInteger(input.sortOrder) || input.sortOrder < 0))
      throw new ConflictException('Category sort order must be a non-negative integer');
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      if (input.parentId) {
        const parent = await tx.category.findFirst({
          where: { id: input.parentId, tenantId, deletedAt: null },
        });
        if (!parent) throw new NotFoundException('Parent category not found');
      }
      return tx.category.create({
        data: {
          tenantId,
          name: input.name.trim(),
          parentId: input.parentId,
          sortOrder: input.sortOrder,
        },
        select: {
          id: true,
          name: true,
          parentId: true,
          sortOrder: true,
          status: true,
          version: true,
          deletedAt: true,
          _count: { select: { products: true, children: true } },
        },
      }).then(this.categoryResponse);
    });
  }

  listCategories(
    tenantId: string,
    includeDeleted = false,
  ): Promise<CategoryResponse[]> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      const items = await tx.category.findMany({
        where: includeDeleted ? { tenantId } : { tenantId, deletedAt: null, status: 'active' },
        select: {
          id: true,
          name: true,
          parentId: true,
          sortOrder: true,
          status: true,
          version: true,
          deletedAt: true,
          _count: { select: { products: true, children: { where: { deletedAt: null } } } },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
      return items.map(this.categoryResponse);
    });
  }

  updateCategory(
    tenantId: string,
    id: string,
    input: UpdateCategoryRequest,
  ): Promise<CategoryResponse> {
    this.assertCatalogInput(input.name, input.status);
    if (!Number.isSafeInteger(input.sortOrder) || input.sortOrder < 0)
      throw new ConflictException('Category sort order must be a non-negative integer');
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      const current = await tx.category.findFirst({ where: { id, tenantId } });
      if (!current) throw new NotFoundException('Category not found');
      await this.assertCategoryParent(tx, tenantId, id, input.parentId ?? null);
      const result = await tx.category.updateMany({
        where: { id, tenantId, deletedAt: null, version: input.version },
        data: {
          name: input.name.trim(),
          parentId: input.parentId,
          sortOrder: input.sortOrder,
          status: input.status,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictException('Category was modified by another request');
      const updated = await tx.category.findFirstOrThrow({
        where: { id, tenantId },
        include: { _count: { select: { products: true, children: { where: { deletedAt: null } } } } },
      });
      return this.categoryResponse(updated);
    });
  }

  createBrand(tenantId: string, input: CreateBrandRequest): Promise<BrandResponse> {
    this.assertName(input.name);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      return tx.brand.create({
        data: { tenantId, name: input.name.trim(), logoUrl: input.logoUrl },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          status: true,
          version: true,
          deletedAt: true,
          _count: { select: { products: true } },
        },
      }).then(this.brandResponse);
    });
  }

  listBrands(
    tenantId: string,
    includeDeleted = false,
  ): Promise<BrandResponse[]> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      const items = await tx.brand.findMany({
        where: includeDeleted ? { tenantId } : { tenantId, deletedAt: null, status: 'active' },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          status: true,
          version: true,
          deletedAt: true,
          _count: { select: { products: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      return items.map(this.brandResponse);
    });
  }

  updateBrand(tenantId: string, id: string, input: UpdateBrandRequest): Promise<BrandResponse> {
    this.assertCatalogInput(input.name, input.status);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      const result = await tx.brand.updateMany({
        where: { id, tenantId, deletedAt: null, version: input.version },
        data: {
          name: input.name.trim(),
          logoUrl: input.logoUrl,
          status: input.status,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictException('Brand was modified by another request');
      const updated = await tx.brand.findFirstOrThrow({
        where: { id, tenantId },
        include: { _count: { select: { products: true } } },
      });
      return this.brandResponse(updated);
    });
  }

  async deleteCategory(tenantId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      const category = await tx.category.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { _count: { select: { products: true, children: { where: { deletedAt: null } } } } },
      });
      if (!category) throw new NotFoundException('Category not found');
      if (category._count.products > 0 || category._count.children > 0)
        throw new ConflictException('Category is still referenced and can only be disabled');
      await tx.category.update({ where: { id }, data: { deletedAt: new Date(), status: 'inactive', version: { increment: 1 } } });
    });
  }

  async restoreCategory(tenantId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      const category = await tx.category.findFirst({ where: { id, tenantId, deletedAt: { not: null } } });
      if (!category) throw new NotFoundException('Deleted category not found');
      if (category.parentId) {
        const parent = await tx.category.findFirst({ where: { id: category.parentId, tenantId, deletedAt: null } });
        if (!parent) throw new ConflictException('Restore the parent category first');
      }
      await tx.category.update({ where: { id }, data: { deletedAt: null, status: 'inactive', version: { increment: 1 } } });
    });
  }

  async deleteBrand(tenantId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      const brand = await tx.brand.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { _count: { select: { products: true } } },
      });
      if (!brand) throw new NotFoundException('Brand not found');
      if (brand._count.products > 0)
        throw new ConflictException('Brand is still referenced and can only be disabled');
      await tx.brand.update({ where: { id }, data: { deletedAt: new Date(), status: 'inactive', version: { increment: 1 } } });
    });
  }

  async restoreBrand(tenantId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      const result = await tx.brand.updateMany({
        where: { id, tenantId, deletedAt: { not: null } },
        data: { deletedAt: null, status: 'inactive', version: { increment: 1 } },
      });
      if (result.count !== 1) throw new NotFoundException('Deleted brand not found');
    });
  }

  private categoryResponse(this: void, item: {
    id: string; name: string; parentId: string | null; sortOrder: number; status: string;
    version: number; deletedAt: Date | null; _count: { products: number; children: number };
  }): CategoryResponse {
    return { ...item, status: item.status as CatalogItemStatus, deletedAt: item.deletedAt?.toISOString() ?? null, productCount: item._count.products, childCount: item._count.children };
  }

  private brandResponse(this: void, item: {
    id: string; name: string; logoUrl: string | null; status: string; version: number;
    deletedAt: Date | null; _count: { products: number };
  }): BrandResponse {
    return { ...item, status: item.status as CatalogItemStatus, deletedAt: item.deletedAt?.toISOString() ?? null, productCount: item._count.products };
  }

  private assertCatalogInput(name: string, status: CatalogItemStatus): void {
    this.assertName(name);
    if (status !== 'active' && status !== 'inactive')
      throw new ConflictException('Unsupported catalog item status');
  }

  private assertName(name: string): void {
    if (!name.trim()) throw new ConflictException('Catalog item name is required');
  }

  private async assertCategoryParent(
    tx: Prisma.TransactionClient,
    tenantId: string,
    categoryId: string,
    parentId: string | null,
  ): Promise<void> {
    let cursor = parentId;
    while (cursor) {
      if (cursor === categoryId) throw new NotFoundException('Category hierarchy cannot form a cycle');
      const parent = await tx.category.findFirst({
        where: { id: cursor, tenantId, deletedAt: null },
        select: { parentId: true },
      });
      if (!parent) throw new NotFoundException('Parent category not found');
      cursor = parent.parentId;
    }
  }
}
