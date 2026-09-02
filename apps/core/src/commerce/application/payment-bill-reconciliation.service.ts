/** 日账单对账服务：比对本地成功支付与渠道账单，并持久化租户级差异。 */
import { Inject, Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import type { ProviderTradeBillEntry } from '../infrastructure/payment-provider.js';
import { PaymentProviderRegistry } from '../infrastructure/payment-provider.registry.js';

type Difference = {
  paymentNo: string;
  type: 'missing_local' | 'missing_provider' | 'amount_mismatch' | 'trade_no_mismatch';
  localAmount?: string;
  providerAmount?: string;
  providerTradeNo?: string;
};

@Injectable()
export class PaymentBillReconciliationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PaymentProviderRegistry) private readonly providers: PaymentProviderRegistry,
  ) {}

  /** 下载指定日期微信账单并完成一次可重复执行的本地对账。 */
  async reconcile(tenantId: string, billDate: string): Promise<number> {
    this.assertBillDate(billDate);
    const entries = await this.providers.get('wechat_pay').downloadTradeBill(billDate);
    const { start, end } = this.shanghaiDayRange(billDate);
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
        const payments = await tx.payment.findMany({
          where: {
            tenantId,
            channel: 'wechat_pay',
            status: 'succeeded',
            paidAt: { gte: start, lt: end },
          },
          orderBy: { paymentNo: 'asc' },
        });
        const differences = this.compare(
          payments.map((payment) => ({
            paymentNo: payment.paymentNo,
            amount: payment.amount.toFixed(2),
            providerTradeNo: payment.providerTradeNo,
          })),
          entries,
        );
        const run = await tx.paymentReconciliationRun.upsert({
          where: {
            tenantId_channel_billDate: {
              tenantId,
              channel: 'wechat_pay',
              billDate: new Date(`${billDate}T00:00:00.000Z`),
            },
          },
          create: {
            tenantId,
            channel: 'wechat_pay',
            billDate: new Date(`${billDate}T00:00:00.000Z`),
            status: differences.length === 0 ? 'matched' : 'mismatched',
            localCount: payments.length,
            providerCount: entries.length,
            discrepancyCount: differences.length,
            completedAt: new Date(),
          },
          update: {
            status: differences.length === 0 ? 'matched' : 'mismatched',
            localCount: payments.length,
            providerCount: entries.length,
            discrepancyCount: differences.length,
            errorMessage: null,
            completedAt: new Date(),
          },
        });
        await tx.paymentReconciliationDiscrepancy.deleteMany({
          where: { tenantId, runId: run.id },
        });
        if (differences.length > 0) {
          await tx.paymentReconciliationDiscrepancy.createMany({
            data: differences.map((difference) => ({
              tenantId,
              runId: run.id,
              paymentNo: difference.paymentNo,
              type: difference.type,
              localAmount: difference.localAmount
                ? new Prisma.Decimal(difference.localAmount)
                : null,
              providerAmount: difference.providerAmount
                ? new Prisma.Decimal(difference.providerAmount)
                : null,
              providerTradeNo: difference.providerTradeNo,
            })),
          });
        }
        await tx.auditLog.create({
          data: {
            tenantId,
            actorType: 'system',
            action: 'reconcile',
            resourceType: 'payment_bill',
            resourceId: run.id,
            diff: { billDate, discrepancyCount: differences.length },
          },
        });
        return differences.length;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 },
    );
  }

  private compare(
    local: Array<{ paymentNo: string; amount: string; providerTradeNo: string | null }>,
    provider: ProviderTradeBillEntry[],
  ): Difference[] {
    const localByNo = new Map(local.map((entry) => [entry.paymentNo, entry]));
    const providerByNo = new Map(provider.map((entry) => [entry.paymentNo, entry]));
    const differences: Difference[] = [];
    for (const entry of local) {
      const remote = providerByNo.get(entry.paymentNo);
      if (!remote)
        differences.push({
          paymentNo: entry.paymentNo,
          type: 'missing_provider',
          localAmount: entry.amount,
        });
      else if (new Prisma.Decimal(entry.amount).comparedTo(remote.amount) !== 0)
        differences.push({
          paymentNo: entry.paymentNo,
          type: 'amount_mismatch',
          localAmount: entry.amount,
          providerAmount: remote.amount,
          providerTradeNo: remote.providerTradeNo,
        });
      else if (entry.providerTradeNo !== remote.providerTradeNo)
        differences.push({
          paymentNo: entry.paymentNo,
          type: 'trade_no_mismatch',
          localAmount: entry.amount,
          providerAmount: remote.amount,
          providerTradeNo: remote.providerTradeNo,
        });
    }
    for (const entry of provider) {
      if (!localByNo.has(entry.paymentNo))
        differences.push({
          paymentNo: entry.paymentNo,
          type: 'missing_local',
          providerAmount: entry.amount,
          providerTradeNo: entry.providerTradeNo,
        });
    }
    return differences;
  }

  private shanghaiDayRange(billDate: string): { start: Date; end: Date } {
    const start = new Date(`${billDate}T00:00:00+08:00`);
    return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
  }

  private assertBillDate(value: string): void {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
    )
      throw new Error('billDate must use YYYY-MM-DD');
  }
}
