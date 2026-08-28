/** 支付回调调度器：按租户扫描并处理待消费的支付回调事件。 */
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { PaymentWebhookInboxService } from '../application/payment-webhook-inbox.service.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class PaymentWebhookScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentWebhookScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(PaymentWebhookInboxService)
    private readonly inbox: PaymentWebhookInboxService,
  ) {}

  onModuleInit(): void {
    if (process.env.PAYMENT_WEBHOOK_WORKER_ENABLED === 'false') return;
    const configured = Number(process.env.PAYMENT_WEBHOOK_SCAN_INTERVAL_MS ?? 1000);
    const intervalMs = Number.isFinite(configured) ? Math.max(configured, 1000) : 1000;
    this.timer = setInterval(() => void this.runOnce(), intervalMs);
    this.timer.unref();
    void this.runOnce();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      let cursor: string | undefined;
      do {
        const tenants = await this.prisma.tenant.findMany({
          where: { status: 'active' },
          select: { id: true },
          orderBy: { id: 'asc' },
          cursor: cursor ? { id: cursor } : undefined,
          skip: cursor ? 1 : 0,
          take: 100,
        });
        for (const tenant of tenants) {
          const processed = await this.inbox.processPending(tenant.id, 100);
          if (processed > 0)
            this.logger.log(`Processed ${processed} payment webhooks for tenant ${tenant.id}`);
        }
        cursor = tenants.length === 100 ? tenants.at(-1)?.id : undefined;
      } while (cursor);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown webhook worker error';
      this.logger.error(`Payment webhook scan failed: ${message}`);
    } finally {
      this.running = false;
    }
  }
}
