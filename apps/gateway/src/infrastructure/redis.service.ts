import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: RedisClientType | null = null;

  async getClient(): Promise<RedisClientType> {
    if (!this.client) {
      this.client = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' });
      this.client.on('error', () => undefined);
    }
    if (!this.client.isOpen) await this.client.connect();
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) await this.client.quit();
  }
}
