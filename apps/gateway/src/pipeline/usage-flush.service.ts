import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { RedisClientType } from 'redis';

import { RedisService } from '../infrastructure/redis.service.js';

@Injectable()
export class UsageFlushService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(private readonly redis: RedisService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.flush(), 5 * 60 * 1000);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }

  async flush(): Promise<void> {
    let client: RedisClientType;
    try {
      client = await this.redis.getClient();
    } catch {
      return;
    }

    for await (const key of client.scanIterator({ MATCH: 'usage:*', COUNT: 100 })) {
      const usageKey = String(key);
      const [, tenantId, metric] = usageKey.split(':');
      if (!tenantId || !metric) continue;
      const value = await client.getDel(usageKey);
      const amount = Number(value ?? 0);
      if (!Number.isSafeInteger(amount) || amount <= 0) continue;

      const coreBaseUrl = process.env.CORE_BASE_URL ?? 'http://localhost:3101';
      try {
        const response = await fetch(
          `${coreBaseUrl}/api/platform/tenants/${tenantId}/usage/${metric}`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ amount }),
          },
        );
        if (!response.ok) await client.incrBy(usageKey, amount);
      } catch {
        await client.incrBy(usageKey, amount);
      }
    }
  }
}
