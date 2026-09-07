import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ProductIntakeService } from '../src/commerce/application/product-intake.service.js';
import { ProductService } from '../src/commerce/application/product.service.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';

const runDatabaseE2e = process.env.RUN_DATABASE_E2E === 'true';

describe.runIf(runDatabaseE2e)('product intake database flow', () => {
  const tenantId = randomUUID();
  const foreignTenantId = randomUUID();
  const suffix = tenantId.slice(0, 8);
  let prisma: PrismaService;
  let service: ProductIntakeService;
  let actorId: string;
  let categoryId: string;
  let brandId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new ProductIntakeService(prisma);
    await prisma.tenant.createMany({
      data: [
        { id: tenantId, name: `Intake ${suffix}`, subdomain: `intake-${suffix}` },
        { id: foreignTenantId, name: `Foreign ${suffix}`, subdomain: `foreign-intake-${suffix}` },
      ],
    });
    const actor = await prisma.adminUser.create({
      data: {
        tenantId,
        email: `owner-${suffix}@example.com`,
        displayName: '本店鉴定员',
        passwordHash: 'not-used',
      },
    });
    actorId = actor.id;
    const category = await prisma.category.create({
      data: { tenantId, name: `测试箱包-${suffix}` },
    });
    categoryId = category.id;
    const brand = await prisma.brand.create({
      data: {
        tenantId,
        name: `测试品牌-${suffix}`,
        englishName: 'Catalog Test',
        initial: 'C',
      },
    });
    brandId = brand.id;
    await prisma.brandCategory.create({ data: { tenantId, brandId, categoryId } });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      await tx.productIntakeMedia.deleteMany({ where: { tenantId } });
      await tx.productImage.deleteMany({ where: { tenantId } });
      await tx.productIntake.deleteMany({ where: { tenantId } });
      await tx.inventoryTransaction.deleteMany({ where: { tenantId } });
      await tx.product.deleteMany({ where: { tenantId } });
      await tx.mediaAsset.deleteMany({ where: { tenantId } });
      await tx.mediaUploadSession.deleteMany({ where: { tenantId } });
      await tx.brandModel.deleteMany({ where: { tenantId } });
      await tx.brandSeries.deleteMany({ where: { tenantId } });
      await tx.recyclingType.deleteMany({ where: { tenantId } });
      await tx.category.deleteMany({ where: { tenantId } });
      await tx.brand.deleteMany({ where: { tenantId } });
      await tx.adminUser.deleteMany({ where: { tenantId } });
      await tx.usageMetric.deleteMany({ where: { tenantId } });
      await tx.auditLog.deleteMany({ where: { tenantId } });
      await tx.domainEventOutbox.deleteMany({ where: { tenantId } });
      await tx.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
    });
    await prisma.$disconnect();
  });

  it('creates default dictionaries and maintains brand series/models', async () => {
    const categories = await service.categories(tenantId);
    expect(categories.map(({ name }) => name)).toEqual(
      expect.arrayContaining(['腕表', '箱包', '珠宝', '服饰', '其他', '配饰']),
    );
    expect((await service.recyclingTypes(tenantId)).map(({ name }) => name)).toEqual([
      '其他',
      '线上',
      '同行',
      '门店',
    ]);
    const series = await service.createSeries(tenantId, brandId, { name: '经典系列' });
    const model = await service.createModel(tenantId, brandId, {
      name: '经典小号',
      seriesId: series.id,
      categoryId,
      officialGuidePrice: '12000.00',
      defaultMaterial: '皮革',
    });
    const otherSeries = await service.createSeries(tenantId, brandId, { name: '其他系列' });
    await service.createModel(tenantId, brandId, {
      name: '其他型号',
      seriesId: otherSeries.id,
      categoryId,
    });
    expect(await service.listModels(tenantId, brandId)).toEqual([
      expect.objectContaining({ seriesId: otherSeries.id }),
      expect.objectContaining({ id: model.id, seriesId: series.id, seriesName: '经典系列' }),
    ]);
    expect(await service.listModels(tenantId, brandId, series.id)).toEqual([
      expect.objectContaining({ id: model.id, seriesId: series.id }),
    ]);
    expect(await service.brandDirectory(tenantId, categoryId)).toEqual([
      {
        initial: 'C',
        brands: [
          expect.objectContaining({
            id: brandId,
            englishName: 'Catalog Test',
            categoryIds: [categoryId],
          }),
        ],
      },
    ]);
    expect(await service.brandDirectory(tenantId, undefined, 'catalog')).toHaveLength(1);
    expect(await service.brandDirectory(tenantId, undefined, '不存在')).toEqual([]);
  });

  it('atomically stocks, keeps stock-only private and makes publish action public', async () => {
    const mainAsset = await createAsset(prisma, tenantId, actorId, 'image/jpeg');
    const request = {
      idempotencyKey: `stock-${suffix}`,
      action: 'stock_only' as const,
      title: '仅入库商品',
      description: '完整的商品描述',
      condition: 'preowned' as const,
      categoryId,
      brandId,
      stockQuantity: 2,
      appraiserEmployeeId: actorId,
      recycledAt: new Date().toISOString(),
      warrantyCard: 'absent' as const,
      productImageAssetIds: [mainAsset],
      accessories: ['none' as const],
    };
    const stocked = await service.create(tenantId, actorId, request);
    const retry = await service.create(tenantId, actorId, request);
    expect(retry.id).toBe(stocked.id);
    await expect(
      service.create(tenantId, actorId, { ...request, title: '复用幂等键的不同商品' }),
    ).rejects.toMatchObject({ response: { code: 40910 } });
    expect(stocked).toMatchObject({
      status: 'stocked',
      stockQuantity: 2,
      inventoryAgeWarningDays: 90,
    });
    expect(
      await prisma.inventoryTransaction.count({ where: { tenantId, referenceId: stocked.id } }),
    ).toBe(1);
    await expect(
      new ProductService(prisma).getPublic(tenantId, stocked.productId),
    ).rejects.toMatchObject({ response: { code: 40401 } });

    const activeMain = await createAsset(prisma, tenantId, actorId, 'image/jpeg');
    const detail = await createAsset(prisma, tenantId, actorId, 'image/webp');
    const published = await service.create(tenantId, actorId, {
      ...request,
      idempotencyKey: `publish-${suffix}`,
      action: 'stock_and_publish',
      title: '入库并上架商品',
      productImageAssetIds: [activeMain],
      detailImageAssetIds: [detail],
      accessories: ['box'],
    });
    expect(published.status).toBe('published');
    const publicProduct = await new ProductService(prisma).getPublic(tenantId, published.productId);
    expect(publicProduct).toMatchObject({ name: '入库并上架商品', availableStockQty: 2 });
    expect(publicProduct.detailMedia).toEqual([
      expect.objectContaining({ assetId: detail, type: 'image' }),
    ]);
  });

  it('rejects cross-tenant employees and conflicting idempotency reuse', async () => {
    const foreign = await prisma.adminUser.create({
      data: {
        tenantId: foreignTenantId,
        email: `foreign-${suffix}@example.com`,
        displayName: '外店员工',
        passwordHash: 'not-used',
      },
    });
    const asset = await createAsset(prisma, tenantId, actorId, 'image/jpeg');
    const base = {
      idempotencyKey: `invalid-${suffix}`,
      action: 'stock_only' as const,
      title: '拒绝商品',
      description: '完整描述',
      condition: 'unused' as const,
      categoryId,
      brandId,
      stockQuantity: 1,
      appraiserEmployeeId: foreign.id,
      recycledAt: new Date().toISOString(),
      warrantyCard: 'present' as const,
      productImageAssetIds: [asset],
    };
    await expect(service.create(tenantId, actorId, base)).rejects.toMatchObject({
      response: { code: 40911 },
    });
    expect(await prisma.product.count({ where: { tenantId, name: base.title } })).toBe(0);
  });
});

async function createAsset(
  prisma: PrismaService,
  tenantId: string,
  actorId: string,
  mimeType: string,
): Promise<string> {
  const id = randomUUID();
  const session = await prisma.mediaUploadSession.create({
    data: {
      tenantId,
      actorId,
      purpose: 'product',
      objectKey: `${tenantId}/product/${id}`,
      fileName: id,
      mimeType,
      sizeBytes: 100,
      status: 'confirmed',
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  const asset = await prisma.mediaAsset.create({
    data: {
      tenantId,
      uploadSessionId: session.id,
      createdBy: actorId,
      purpose: 'product',
      objectKey: session.objectKey,
      mimeType,
      sizeBytes: 100,
      sha256: 'a'.repeat(64),
    },
  });
  return asset.id;
}
