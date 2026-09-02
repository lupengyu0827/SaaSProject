/** 日账单对账调度器：每天北京时间 10 点后尝试对账昨日微信交易账单。 */
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { PaymentBillReconciliationService } from '../application/payment-bill-reconciliation.service.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';

const SCAN_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class PaymentBillReconciliationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentBillReconciliationScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PaymentBillReconciliationService)
    private readonly reconciliation: PaymentBillReconciliationService,
  ) {}

  onModuleInit(): void {
    if (process.env.PAYMENT_BILL_RECONCILIATION_ENABLED === 'false') return;
    this.timer = setInterval(() => void this.runOnce(), SCAN_INTERVAL_MS);
    this.timer.unref();
    void this.runOnce();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(now = new Date()): Promise<void> {
    if (this.running || this.shanghaiHour(now) < 10) return;
    this.running = true;
    try {
      const billDate = this.previousShanghaiDate(now);
      const tenants = await this.prisma.tenant.findMany({
        where: { status: 'active' },
        select: { id: true },
      });
      for (const tenant of tenants) {
        const count = await this.reconciliation.reconcile(tenant.id, billDate);
        if (count > 0)
          this.logger.warn(
            `Payment bill ${billDate} has ${count} discrepancies for tenant ${tenant.id}`,
          );
      }
    } catch (error: unknown) {
      this.logger.error(
        error instanceof Error ? error.message : 'Payment bill reconciliation failed',
      );
    } finally {
      this.running = false;
    }
  }

  private shanghaiHour(date: Date): number {
    return Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Shanghai',
        hour: '2-digit',
        hour12: false,
      }).format(date),
    );
  }

  private previousShanghaiDate(date: Date): string {
    const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(yesterday);
  }
}
