/** 订单过期调度器：按租户扫描并关闭超过支付时限的待支付订单。 */
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { OrderService } from '../application/order.service.js';

@Injectable()
export class OrderExpirationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderExpirationScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(OrderService)
    private readonly orders: OrderService,
  ) {}

  onModuleInit(): void {
    if (process.env.ORDER_EXPIRATION_SCHEDULER_ENABLED === 'false') return;
    const configuredInterval = Number(process.env.ORDER_EXPIRATION_SCAN_INTERVAL_MS ?? 60_000);
    const intervalMs = Number.isFinite(configuredInterval)
      ? Math.max(configuredInterval, 10_000)
      : 60_000;
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
          try {
            const result = await this.orders.expirePending(tenant.id, 100);
            if (result.expired > 0)
              this.logger.log(`Expired ${result.expired} orders for tenant ${tenant.id}`);
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown scheduler error';
            this.logger.error(`Failed to expire orders for tenant ${tenant.id}: ${message}`);
          }
        }
        cursor = tenants.length === 100 ? tenants.at(-1)?.id : undefined;
      } while (cursor);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown scheduler error';
      this.logger.error(`Order expiration scan failed: ${message}`);
    } finally {
      this.running = false;
    }
  }
}
