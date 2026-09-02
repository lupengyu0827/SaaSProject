/** 支付主动查单补偿测试：验证终态进入 Inbox，待支付状态保持不变。 */
import { describe, expect, it, vi } from 'vitest';

import { PaymentReconciliationService } from '../src/commerce/application/payment-reconciliation.service.js';
import type { PaymentWebhookInboxService } from '../src/commerce/application/payment-webhook-inbox.service.js';
import type { PaymentProviderRegistry } from '../src/commerce/infrastructure/payment-provider.registry.js';
import type { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { Prisma, type Payment } from '../src/generated/prisma/index.js';

function paymentRecord(): Payment {
  const createdAt = new Date(Date.now() - 120_000);
  return {
    id: 'payment-1',
    tenantId: 'tenant-1',
    orderId: 'order-1',
    paymentNo: 'P202608280001',
    idempotencyKey: 'payment-key',
    channel: 'wechat_pay',
    status: 'pending',
    amount: new Prisma.Decimal('19.90'),
    providerTradeNo: null,
    callbackEventId: null,
    failureReason: null,
    paidAt: null,
    createdBy: null,
    createdAt,
    updatedAt: createdAt,
  };
}

describe('PaymentReconciliationService', () => {
  it('enqueues and processes a successful provider query exactly once', async () => {
    const prisma = {
      $transaction: vi.fn(async (operation: (tx: object) => Promise<unknown>) =>
        operation({
          $executeRaw: vi.fn().mockResolvedValue(1),
          payment: { findMany: vi.fn().mockResolvedValue([paymentRecord()]) },
        }),
      ),
    } as unknown as PrismaService;
    const queryPayment = vi.fn().mockResolvedValue({
      status: 'succeeded',
      providerTradeNo: 'wx-trade-1',
      paidAmount: '19.90',
    });
    const providers = {
      get: vi.fn().mockReturnValue({ queryPayment }),
    } as unknown as PaymentProviderRegistry;
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const processPending = vi.fn().mockResolvedValue(1);
    const inbox = { enqueue, processPending } as unknown as PaymentWebhookInboxService;

    const count = await new PaymentReconciliationService(prisma, providers, inbox).reconcilePending(
      'tenant-1',
    );

    expect(count).toBe(1);
    expect(enqueue).toHaveBeenCalledWith(
      'tenant-1',
      'wechat_pay',
      'query:P202608280001:succeeded:wx-trade-1',
      expect.objectContaining({ succeeded: true, paidAmount: '19.90' }),
    );
    expect(processPending).toHaveBeenCalledWith('tenant-1', 1);
  });

  it('does not enqueue a provider state that is still pending', async () => {
    const prisma = {
      $transaction: vi.fn(async (operation: (tx: object) => Promise<unknown>) =>
        operation({
          $executeRaw: vi.fn().mockResolvedValue(1),
          payment: { findMany: vi.fn().mockResolvedValue([paymentRecord()]) },
        }),
      ),
    } as unknown as PrismaService;
    const providers = {
      get: vi
        .fn()
        .mockReturnValue({ queryPayment: vi.fn().mockResolvedValue({ status: 'pending' }) }),
    } as unknown as PaymentProviderRegistry;
    const enqueue = vi.fn();
    const inbox = { enqueue, processPending: vi.fn() } as unknown as PaymentWebhookInboxService;

    await expect(
      new PaymentReconciliationService(prisma, providers, inbox).reconcilePending('tenant-1'),
    ).resolves.toBe(0);
    expect(enqueue).not.toHaveBeenCalled();
  });
});
