/** 支付主动查单应用服务：扫描长时间待支付记录，并通过 Inbox 补偿遗漏回调。 */
import { Inject, Injectable } from '@nestjs/common';
import type { PaymentChannel } from '@saas/contracts';

import { Prisma, type Payment } from '../../generated/prisma/index.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { PaymentProviderRegistry } from '../infrastructure/payment-provider.registry.js';
import { PaymentWebhookInboxService } from './payment-webhook-inbox.service.js';

const MAX_QUERY_BATCH_SIZE = 100;
const DEFAULT_PENDING_AGE_MS = 60_000;

@Injectable()
export class PaymentReconciliationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PaymentProviderRegistry) private readonly providers: PaymentProviderRegistry,
    @Inject(PaymentWebhookInboxService) private readonly inbox: PaymentWebhookInboxService,
  ) {}

  /** 查询一个租户的陈旧待支付记录，并将渠道终态送入幂等 Inbox。 */
  async reconcilePending(tenantId: string, limit = MAX_QUERY_BATCH_SIZE): Promise<number> {
    const payments = await this.findPending(tenantId, limit);
    let reconciled = 0;
    for (const payment of payments) {
      const result = await this.providers.get(payment.channel as PaymentChannel).queryPayment({
        paymentNo: payment.paymentNo,
        amount: payment.amount.toFixed(2),
      });
      if (result.status === 'pending') continue;
      const providerTradeNo = result.providerTradeNo ?? `${payment.channel}:${payment.paymentNo}`;
      await this.inbox.enqueue(
        tenantId,
        payment.channel,
        `query:${payment.paymentNo}:${result.status}:${providerTradeNo}`,
        {
          paymentId: payment.id,
          paymentNo: payment.paymentNo,
          providerTradeNo,
          paidAmount: result.paidAmount ?? payment.amount.toFixed(2),
          succeeded: result.status === 'succeeded',
          failureReason: result.failureReason,
        },
      );
      reconciled += 1;
    }
    if (reconciled > 0) await this.inbox.processPending(tenantId, reconciled);
    return reconciled;
  }

  private findPending(tenantId: string, limit: number): Promise<Payment[]> {
    const configured = Number(process.env.PAYMENT_RECONCILIATION_PENDING_AGE_MS);
    const pendingAgeMs = Number.isFinite(configured)
      ? Math.max(configured, DEFAULT_PENDING_AGE_MS)
      : DEFAULT_PENDING_AGE_MS;
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
        return tx.payment.findMany({
          where: {
            tenantId,
            status: 'pending',
            createdAt: { lte: new Date(Date.now() - pendingAgeMs) },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: Math.min(Math.max(limit, 1), MAX_QUERY_BATCH_SIZE),
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
}
