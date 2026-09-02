/** 支付查单调度器：按租户周期性补偿可能遗漏的支付回调。 */
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { PaymentReconciliationService } from '../application/payment-reconciliation.service.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class PaymentReconciliationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentReconciliationScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PaymentReconciliationService)
    private readonly reconciliation: PaymentReconciliationService,
  ) {}

  onModuleInit(): void {
    if (process.env.PAYMENT_RECONCILIATION_WORKER_ENABLED === 'false') return;
    const configured = Number(process.env.PAYMENT_RECONCILIATION_INTERVAL_MS ?? 60_000);
    const intervalMs = Number.isFinite(configured) ? Math.max(configured, 10_000) : 60_000;
    this.timer = setInterval(() => void this.runOnce(), intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const tenants = await this.prisma.tenant.findMany({
        where: { status: 'active' },
        select: { id: true },
        orderBy: { id: 'asc' },
      });
      for (const tenant of tenants) {
        const count = await this.reconciliation.reconcilePending(tenant.id);
        if (count > 0) this.logger.log(`Reconciled ${count} payments for tenant ${tenant.id}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown reconciliation error';
      this.logger.error(`Payment reconciliation failed: ${message}`);
    } finally {
      this.running = false;
    }
  }
}
