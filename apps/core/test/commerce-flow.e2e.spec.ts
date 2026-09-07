import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { InventoryService } from '../src/commerce/application/inventory.service.js';
import { OrderService } from '../src/commerce/application/order.service.js';
import { PaymentWebhookInboxService } from '../src/commerce/application/payment-webhook-inbox.service.js';
import { PaymentService } from '../src/commerce/application/payment.service.js';
import { ProductService } from '../src/commerce/application/product.service.js';
import { ShipmentService } from '../src/commerce/application/shipment.service.js';
import { RefundService } from '../src/commerce/application/refund.service.js';
import { RefundWebhookInboxService } from '../src/commerce/application/refund-webhook-inbox.service.js';
import { MockPaymentProvider } from '../src/commerce/infrastructure/mock-payment.provider.js';
import { PaymentProviderRegistry } from '../src/commerce/infrastructure/payment-provider.registry.js';
import { WechatPayProvider } from '../src/commerce/infrastructure/wechat-pay.provider.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';

const runDatabaseE2e = process.env.RUN_DATABASE_E2E === 'true';

describe.runIf(runDatabaseE2e)('commerce database flow', () => {
  const tenantId = randomUUID();
  const actorId = randomUUID();
  const suffix = tenantId.slice(0, 8);
  const planCode = `e2e-one-product-${suffix}`;
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await prisma.tenant.create({
      data: { id: tenantId, name: `E2E Store ${suffix}`, subdomain: `e2e-${suffix}` },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      await tx.paymentWebhookEvent.deleteMany({ where: { tenantId } });
      await tx.refundWebhookEvent.deleteMany({ where: { tenantId } });
      await tx.payment.deleteMany({ where: { tenantId } });
      await tx.refundTransaction.deleteMany({ where: { tenantId } });
      await tx.refundItem.deleteMany({ where: { tenantId } });
      await tx.refund.deleteMany({ where: { tenantId } });
      await tx.shipmentItem.deleteMany({ where: { tenantId } });
      await tx.shipment.deleteMany({ where: { tenantId } });
      await tx.inventoryTransaction.deleteMany({ where: { tenantId } });
      await tx.order.deleteMany({ where: { tenantId } });
      await tx.productImage.deleteMany({ where: { tenantId } });
      await tx.mediaAsset.deleteMany({ where: { tenantId } });
      await tx.mediaUploadSession.deleteMany({ where: { tenantId } });
      await tx.product.deleteMany({ where: { tenantId } });
      await tx.category.deleteMany({ where: { tenantId } });
      await tx.brand.deleteMany({ where: { tenantId } });
      await tx.providerCallbackRoute.deleteMany({ where: { tenantId } });
      await tx.tenant.deleteMany({ where: { id: tenantId } });
      await tx.plan.deleteMany({ where: { code: planCode } });
    });
    await prisma.$disconnect();
  });

  it('creates, autosaves, binds media and atomically publishes a mobile draft', async () => {
    const products = new ProductService(prisma);
    const category = await prisma.category.create({
      data: { tenantId, name: `S2 Category ${suffix}` },
    });
    const session = await prisma.mediaUploadSession.create({
      data: {
        tenantId,
        actorId,
        purpose: 'product',
        objectKey: `${tenantId}/product/s2-${suffix}.jpg`,
        fileName: 's2.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
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
        mimeType: session.mimeType,
        sizeBytes: session.sizeBytes,
        sha256: 'a'.repeat(64),
      },
    });

    const emptyDraft = await products.createDraft(tenantId, actorId, {});
    expect(await products.validateDraftPublish(tenantId, emptyDraft.id)).toMatchObject({
      valid: false,
    });
    const saved = await products.saveDraft(tenantId, actorId, emptyDraft.id, {
      version: emptyDraft.version,
      name: 'S2 Mobile Product',
      categoryId: category.id,
      price: '12800.00',
      conditionGrade: 'excellent',
      material: '粒面皮革',
    });
    const withMedia = await products.bindDraftMedia(tenantId, actorId, saved.id, {
      version: saved.version,
      assetIds: [asset.id],
      primaryAssetId: asset.id,
    });
    expect(await products.getDraft(tenantId, withMedia.id)).toMatchObject({
      id: withMedia.id,
      status: 'draft',
    });
    expect((await products.listDrafts(tenantId, { keyword: 'S2 Mobile' })).list).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: withMedia.id })]),
    );
    const duplicate = await products.duplicateDraft(
      tenantId,
      actorId,
      withMedia.id,
      withMedia.version,
    );
    expect(duplicate).toMatchObject({ name: withMedia.name, status: 'draft', images: [] });
    await expect(
      products.deleteDraft(tenantId, actorId, duplicate.id, duplicate.version + 1),
    ).rejects.toMatchObject({ response: { code: 40901 } });
    await products.deleteDraft(tenantId, actorId, duplicate.id, duplicate.version);
    await expect(products.getDraft(tenantId, duplicate.id)).rejects.toThrow('商品草稿不存在');
    expect(await products.validateDraftPublish(tenantId, withMedia.id)).toEqual({
      valid: true,
      issues: [],
    });

    const oneProductPlan = await prisma.plan.create({
      data: {
        code: planCode,
        name: 'E2E 单商品套餐',
        isolationLevel: 'logical',
        features: ['products.basic'],
        quotas: { products: 1 },
      },
    });
    await prisma.tenant.update({ where: { id: tenantId }, data: { planId: oneProductPlan.id } });

    await expect(
      products.publishDraft(tenantId, actorId, withMedia.id, withMedia.version - 1),
    ).rejects.toMatchObject({
      response: { code: 40901, data: { currentVersion: withMedia.version } },
    });
    expect(
      await prisma.inventoryTransaction.count({
        where: { tenantId, variantId: withMedia.variants[0]?.id },
      }),
    ).toBe(0);
    expect(
      await prisma.usageMetric.findFirst({ where: { tenantId, metricKey: 'products' } }),
    ).toBeNull();

    const published = await products.publishDraft(
      tenantId,
      actorId,
      withMedia.id,
      withMedia.version,
    );
    expect(published.product).toMatchObject({ status: 'active', availableStockQty: 1 });
    const publishedVariantId = published.product.variants[0]?.id;
    if (!publishedVariantId) throw new Error('Published draft did not contain its default SKU');
    const usageAfterPublish = await prisma.usageMetric.findFirst({
      where: { tenantId, metricKey: 'products' },
    });
    const stockRowsAfterPublish = await prisma.inventoryTransaction.count({
      where: { tenantId, variantId: publishedVariantId },
    });
    const retried = await products.publishDraft(tenantId, actorId, withMedia.id, withMedia.version);
    expect(retried.product).toMatchObject({
      id: published.product.id,
      status: 'active',
      version: published.product.version,
    });
    expect(
      await prisma.usageMetric.findFirst({ where: { tenantId, metricKey: 'products' } }),
    ).toEqual(usageAfterPublish);
    expect(
      await prisma.inventoryTransaction.count({
        where: { tenantId, variantId: publishedVariantId },
      }),
    ).toBe(stockRowsAfterPublish);
    await prisma.tenant.update({ where: { id: tenantId }, data: { planId: null } });

    const foreignTenantId = randomUUID();
    await prisma.tenant.create({
      data: {
        id: foreignTenantId,
        name: 'E2E Foreign Store',
        subdomain: `foreign-${foreignTenantId.slice(0, 8)}`,
      },
    });
    await expect(
      products.unlist(foreignTenantId, actorId, published.product.id, {
        version: published.product.version,
        reason: '跨租户尝试',
      }),
    ).rejects.toThrow('商品不存在');
    await prisma.tenant.delete({ where: { id: foreignTenantId } });

    await expect(
      products.unlist(tenantId, actorId, published.product.id, {
        version: published.product.version - 1,
        reason: '旧版本下架',
      }),
    ).rejects.toMatchObject({ response: { code: 40901 } });
    const unlisted = await products.unlist(tenantId, actorId, published.product.id, {
      version: published.product.version,
      reason: '商品资料需要调整',
    });
    expect(unlisted.status).toBe('archived');
    const unlistedRetry = await products.unlist(tenantId, actorId, published.product.id, {
      version: published.product.version,
      reason: '商品资料需要调整',
    });
    expect(unlistedRetry.version).toBe(unlisted.version);
    expect(
      await prisma.domainEventOutbox.count({
        where: { tenantId, aggregateId: published.product.id, eventType: 'product.unlisted' },
      }),
    ).toBe(1);
    await expect(products.getPublic(tenantId, published.product.id)).rejects.toMatchObject({
      response: { code: 40401, data: { availability: 'unlisted' } },
    });
    await expect(
      products.update(tenantId, actorId, published.product.id, {
        version: unlisted.version,
        status: 'active',
      }),
    ).rejects.toMatchObject({ response: { code: 40902 } });

    await prisma.inventoryTransaction.create({
      data: {
        tenantId,
        variantId: publishedVariantId,
        type: 'outbound',
        qtyChange: -1,
        referenceType: 'lifecycle_test',
        referenceId: `out-${suffix}`,
        reason: '模拟售罄',
        operatorId: actorId,
      },
    });
    await expect(
      products.relist(tenantId, actorId, published.product.id, {
        version: unlisted.version,
        reason: '库存不足时尝试上架',
      }),
    ).rejects.toMatchObject({ response: { code: 40903 } });
    await prisma.inventoryTransaction.create({
      data: {
        tenantId,
        variantId: publishedVariantId,
        type: 'inbound',
        qtyChange: 1,
        referenceType: 'lifecycle_test',
        referenceId: `in-${suffix}`,
        reason: '恢复库存',
        operatorId: actorId,
      },
    });
    const relisted = await products.relist(tenantId, actorId, published.product.id, {
      version: unlisted.version,
      reason: '资料调整完成',
    });
    expect(relisted.status).toBe('active');
    expect(
      await products.relist(tenantId, actorId, published.product.id, {
        version: unlisted.version,
        reason: '资料调整完成',
      }),
    ).toMatchObject({ version: relisted.version });
    const lifecycleEvents = await products.listLifecycleEvents(tenantId, published.product.id);
    expect(lifecycleEvents.map(({ type }) => type)).toEqual(['relisted', 'unlisted', 'published']);
    const publicProduct = await products.getPublic(tenantId, withMedia.id);
    expect(publicProduct).toMatchObject({ name: 'S2 Mobile Product', availableStockQty: 1 });
    expect(JSON.stringify(publicProduct)).not.toContain('costPrice');
    expect(await prisma.mediaAsset.findUnique({ where: { id: asset.id } })).toMatchObject({
      status: 'attached',
    });
  });

  it('runs product, inventory, order and asynchronous payment to completion', async () => {
    const products = new ProductService(prisma);
    const inventory = new InventoryService(prisma);
    const orders = new OrderService(prisma);
    const providers = new PaymentProviderRegistry(
      new MockPaymentProvider(),
      new WechatPayProvider(),
    );
    const payments = new PaymentService(prisma, providers);
    const inbox = new PaymentWebhookInboxService(prisma, payments);
    const shipments = new ShipmentService(prisma);
    const refunds = new RefundService(prisma, providers);
    const refundInbox = new RefundWebhookInboxService(prisma, refunds);

    const draft = await products.create(tenantId, actorId, {
      code: `E2E-${suffix}`,
      name: 'Database E2E Product',
      variants: [{ sku: `SKU-${suffix}`, price: '19.90' }],
    });
    // 订单链路测试使用数据库夹具激活商品，不调用已封堵的通用状态修改接口。
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      await tx.product.update({
        where: { id: draft.id },
        data: { status: 'active', version: { increment: 1 } },
      });
    });
    const product = await products.get(tenantId, draft.id);
    const variantId = product.variants[0]?.id;
    expect(variantId).toBeTruthy();
    if (!variantId) throw new Error('E2E product did not create a SKU');

    await inventory.execute(tenantId, actorId, 'in', {
      variantId,
      quantity: 10,
      referenceType: 'test',
      referenceId: `stock-${suffix}`,
    });
    const order = await orders.create(tenantId, actorId, {
      idempotencyKey: `order-${suffix}`,
      items: [{ variantId, quantity: 2 }],
      shippingAddress: { city: 'Shanghai' },
    });
    expect(await inventory.getBalance(tenantId, variantId)).toMatchObject({
      onHand: 10,
      locked: 2,
      available: 8,
    });

    const payment = await payments.create(tenantId, actorId, {
      orderId: order.id,
      channel: 'mock',
      idempotencyKey: `payment-${suffix}`,
    });
    const checkout = await payments.checkout(tenantId, payment.id, {});
    expect(checkout.payload.token).toHaveLength(64);
    await inbox.enqueue(tenantId, 'mock', `event-${suffix}`, {
      paymentId: payment.id,
      paymentNo: payment.paymentNo,
      providerTradeNo: `mock-trade-${suffix}`,
      paidAmount: payment.amount,
      succeeded: true,
    });
    expect(await inbox.processPending(tenantId)).toBe(1);

    expect(await payments.get(tenantId, payment.id)).toMatchObject({ status: 'succeeded' });
    expect(await orders.get(tenantId, order.id)).toMatchObject({ status: 'paid' });
    expect(await inventory.getBalance(tenantId, variantId)).toMatchObject({
      onHand: 8,
      locked: 0,
      available: 8,
    });

    const shipment = await shipments.create(tenantId, actorId, order.id, {
      carrierCode: 'SF',
      carrierName: '顺丰速运',
      trackingNo: `SF-${suffix}`,
    });
    expect(shipment.items).toHaveLength(1);
    expect(await shipments.list(tenantId, order.id)).toHaveLength(1);
    expect(await orders.get(tenantId, order.id)).toMatchObject({ status: 'fulfilled' });

    const orderItemId = order.items[0]?.id;
    if (!orderItemId) throw new Error('E2E order did not create an item');
    const refund = await refunds.create(tenantId, actorId, order.id, {
      idempotencyKey: `refund-${suffix}`,
      reason: 'Database E2E refund',
      items: [{ orderItemId, quantity: 1 }],
    });
    expect(refund).toMatchObject({ status: 'pending_review', amount: '19.90' });
    expect(await refunds.review(tenantId, actorId, refund.id, { approved: true })).toMatchObject({
      status: 'approved',
    });
    expect(await refunds.execute(tenantId, actorId, refund.id)).toMatchObject({
      status: 'succeeded',
      transactions: [{ channel: 'mock', status: 'succeeded' }],
    });
    expect(await inventory.getBalance(tenantId, variantId)).toMatchObject({
      onHand: 9,
      locked: 0,
      available: 9,
    });
    expect(await orders.get(tenantId, order.id)).toMatchObject({ status: 'partially_refunded' });
    expect(await refunds.execute(tenantId, actorId, refund.id)).toMatchObject({
      status: 'succeeded',
    });
    expect(await inventory.getBalance(tenantId, variantId)).toMatchObject({ onHand: 9 });

    const secondRefund = await refunds.create(tenantId, actorId, order.id, {
      idempotencyKey: `refund-second-${suffix}`,
      reason: 'Database E2E asynchronous refund',
      items: [{ orderItemId, quantity: 1 }],
    });
    await refunds.review(tenantId, actorId, secondRefund.id, { approved: true });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      await tx.refundTransaction.create({
        data: {
          tenantId,
          refundId: secondRefund.id,
          channel: 'mock',
          amount: secondRefund.amount,
        },
      });
    });
    await refundInbox.enqueue(tenantId, 'mock', `refund-event-${suffix}`, {
      refundId: secondRefund.id,
      providerRefundNo: `mock-refund-second-${suffix}`,
      refundedAmount: secondRefund.amount,
      succeeded: true,
    });
    expect(await refundInbox.processPending(tenantId)).toBe(1);
    expect(await orders.get(tenantId, order.id)).toMatchObject({ status: 'refunded' });
    expect(await inventory.getBalance(tenantId, variantId)).toMatchObject({ onHand: 10 });
  });
});
