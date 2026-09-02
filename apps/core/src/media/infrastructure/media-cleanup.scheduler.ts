/** 媒体清理调度器：单实例防重入，周期执行可幂等清理用例。 */
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { MediaCleanupService } from '../application/media-cleanup.service.js';

@Injectable()
export class MediaCleanupScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaCleanupScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(@Inject(MediaCleanupService) private readonly cleanup: MediaCleanupService) {}

  onModuleInit(): void {
    if (process.env.MEDIA_CLEANUP_ENABLED === 'false') return;
    const configured = Number(process.env.MEDIA_CLEANUP_INTERVAL_MS ?? 3_600_000);
    const intervalMs = Number.isFinite(configured) ? Math.max(configured, 60_000) : 3_600_000;
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
      const result = await this.cleanup.run();
      if (result.expiredSessions + result.purgedTemporaryAssets + result.purgedDeletedAssets > 0) {
        this.logger.log(
          `Expired sessions=${result.expiredSessions}, temporary=${result.purgedTemporaryAssets}, deleted=${result.purgedDeletedAssets}`,
        );
      }
      if (result.failures > 0) this.logger.warn(`Media cleanup failures=${result.failures}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown media cleanup error';
      this.logger.error(`Media cleanup scan failed: ${message}`);
    } finally {
      this.running = false;
    }
  }
}
