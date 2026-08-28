import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateBrandRequest, CreateCategoryRequest } from '@saas/contracts';

import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  createCategory(
    tenantId: string,
    input: CreateCategoryRequest,
  ): Promise<{ id: string; name: string }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      if (input.parentId) {
        const parent = await tx.category.findFirst({ where: { id: input.parentId, tenantId } });
        if (!parent) throw new NotFoundException('Parent category not found');
      }
      return tx.category.create({
        data: {
          tenantId,
          name: input.name.trim(),
          parentId: input.parentId,
          sortOrder: input.sortOrder,
        },
        select: { id: true, name: true },
      });
    });
  }

  listCategories(
    tenantId: string,
  ): Promise<Array<{ id: string; name: string; parentId: string | null }>> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      return tx.category.findMany({
        where: { tenantId },
        select: { id: true, name: true, parentId: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    });
  }

  createBrand(tenantId: string, input: CreateBrandRequest): Promise<{ id: string; name: string }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      return tx.brand.create({
        data: { tenantId, name: input.name.trim(), logoUrl: input.logoUrl },
        select: { id: true, name: true },
      });
    });
  }

  listBrands(
    tenantId: string,
  ): Promise<Array<{ id: string; name: string; logoUrl: string | null }>> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      return tx.brand.findMany({
        where: { tenantId },
        select: { id: true, name: true, logoUrl: true },
        orderBy: { createdAt: 'asc' },
      });
    });
  }
}
