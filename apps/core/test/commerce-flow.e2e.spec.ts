import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { InventoryService } from '../src/commerce/application/inventory.service.js';
import { OrderService } from '../src/commerce/application/order.service.js';
import { PaymentWebhookInboxService } from '../src/commerce/application/payment-webhook-inbox.service.js';
import { PaymentService } from '../src/commerce/application/payment.service.js';
import { ProductService } from '../src/commerce/application/product.service.js';
import { ShipmentService } from '../src/commerce/application/shipment.service.js';
import { RefundService } from '../src/commerce/application/refund.service.js';
import { MockPaymentProvider } from '../src/commerce/infrastructure/mock-payment.provider.js';
import { PaymentProviderRegistry } from '../src/commerce/infrastructure/payment-provider.registry.js';
import { WechatPayProvider } from '../src/commerce/infrastructure/wechat-pay.provider.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';

const runDatabaseE2e = process.env.RUN_DATABASE_E2E === 'true';

describe.runIf(runDatabaseE2e)('commerce database flow', () => {
  const tenantId = randomUUID();
  const actorId = randomUUID();
  const suffix = tenantId.slice(0, 8);
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
      await tx.payment.deleteMany({ where: { tenantId } });
      await tx.refundTransaction.deleteMany({ where: { tenantId } });
      await tx.refundItem.deleteMany({ where: { tenantId } });
      await tx.refund.deleteMany({ where: { tenantId } });
      await tx.shipmentItem.deleteMany({ where: { tenantId } });
      await tx.shipment.deleteMany({ where: { tenantId } });
      await tx.inventoryTransaction.deleteMany({ where: { tenantId } });
      await tx.order.deleteMany({ where: { tenantId } });
      await tx.product.deleteMany({ where: { tenantId } });
      await tx.category.deleteMany({ where: { tenantId } });
      await tx.brand.deleteMany({ where: { tenantId } });
      await tx.tenant.deleteMany({ where: { id: tenantId } });
    });
    await prisma.$disconnect();
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

    const draft = await products.create(tenantId, actorId, {
      code: `E2E-${suffix}`,
      name: 'Database E2E Product',
      variants: [{ sku: `SKU-${suffix}`, price: '19.90' }],
    });
    const product = await products.update(tenantId, actorId, draft.id, {
      status: 'active',
      version: draft.version,
    });
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
  });
});
