/** 退款回调调度器：逐租户扫描退款 Inbox，失败事件自动重试并最终进入死信。 */
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { RefundWebhookInboxService } from '../application/refund-webhook-inbox.service.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class RefundWebhookScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RefundWebhookScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RefundWebhookInboxService) private readonly inbox: RefundWebhookInboxService,
  ) {}

  onModuleInit(): void {
    if (process.env.REFUND_WEBHOOK_WORKER_ENABLED === 'false') return;
    const configured = Number(process.env.REFUND_WEBHOOK_SCAN_INTERVAL_MS ?? 1000);
    const intervalMs = Number.isFinite(configured) ? Math.max(configured, 1000) : 1000;
    this.timer = setInterval(() => void this.runOnce(), intervalMs);
    this.timer.unref();
    void this.runOnce();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** 执行一轮全租户扫描。 */
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
        for (const tenant of tenants) await this.inbox.processPending(tenant.id, 100);
        cursor = tenants.length === 100 ? tenants.at(-1)?.id : undefined;
      } while (cursor);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown refund worker error';
      this.logger.error(`Refund webhook scan failed: ${message}`);
    } finally {
      this.running = false;
    }
  }
}
