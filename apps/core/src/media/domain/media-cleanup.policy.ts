/** 媒体清理保留策略：纯领域计算，不依赖数据库、存储或环境变量。 */
export interface MediaCleanupPolicyInput {
  temporaryRetentionHours: number;
  deletedRetentionHours: number;
  batchSize: number;
}

export class MediaCleanupPolicy {
  readonly temporaryRetentionMs: number;
  readonly deletedRetentionMs: number;
  readonly batchSize: number;

  constructor(input: MediaCleanupPolicyInput) {
    this.temporaryRetentionMs = toMilliseconds(input.temporaryRetentionHours, 168);
    this.deletedRetentionMs = toMilliseconds(input.deletedRetentionHours, 720);
    this.batchSize = Number.isSafeInteger(input.batchSize)
      ? Math.min(Math.max(input.batchSize, 1), 500)
      : 100;
  }

  temporaryCutoff(now: Date): Date {
    return new Date(now.getTime() - this.temporaryRetentionMs);
  }

  deletedCutoff(now: Date): Date {
    return new Date(now.getTime() - this.deletedRetentionMs);
  }
}

function toMilliseconds(value: number, fallbackHours: number): number {
  const hours = Number.isFinite(value) && value > 0 ? value : fallbackHours;
  return hours * 60 * 60 * 1000;
}
