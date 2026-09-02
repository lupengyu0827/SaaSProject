/** 媒体清理用例：按保留策略清理孤立对象，并以原子认领保证幂等。 */
import { Inject, Injectable } from '@nestjs/common';

import {
  MEDIA_STORAGE_PORT,
  type MediaStoragePort,
} from '../../shared/ports/media-storage.port.js';
import { MediaCleanupPolicy } from '../domain/media-cleanup.policy.js';
import {
  MEDIA_CLEANUP_REPOSITORY,
  type MediaCleanupObject,
  type MediaCleanupRepository,
} from './ports/media-cleanup.repository.port.js';

export interface MediaCleanupResult {
  expiredSessions: number;
  purgedTemporaryAssets: number;
  purgedDeletedAssets: number;
  failures: number;
}

@Injectable()
export class MediaCleanupService {
  constructor(
    @Inject(MEDIA_CLEANUP_REPOSITORY) private readonly repository: MediaCleanupRepository,
    @Inject(MEDIA_STORAGE_PORT) private readonly storage: MediaStoragePort,
  ) {}

  async run(now = new Date()): Promise<MediaCleanupResult> {
    const policy = policyFromEnvironment();
    const result: MediaCleanupResult = {
      expiredSessions: 0,
      purgedTemporaryAssets: 0,
      purgedDeletedAssets: 0,
      failures: 0,
    };
    const sessions = await this.repository.findExpiredSessions(now, policy.batchSize);
    for (const session of sessions) await this.expireSession(session, now, result);

    const temporaryAssets = await this.repository.findExpiredTemporaryAssets(
      policy.temporaryCutoff(now),
      policy.batchSize,
    );
    for (const asset of temporaryAssets) await this.purgeTemporaryAsset(asset, now, result);

    const deletedAssets = await this.repository.findDeletedAssets(
      policy.deletedCutoff(now),
      policy.batchSize,
    );
    for (const asset of deletedAssets) await this.purgeDeletedAsset(asset, now, result);
    return result;
  }

  private async expireSession(
    session: MediaCleanupObject,
    now: Date,
    result: MediaCleanupResult,
  ): Promise<void> {
    if (!(await this.repository.claimExpiredSession(session.id, now))) return;
    try {
      await this.storage.delete(session.objectKey);
      await this.repository.recordCleanup(
        session.tenantId,
        session.id,
        'media.session.expired',
        session.objectKey,
      );
      result.expiredSessions += 1;
    } catch {
      await this.repository.restoreExpiredSession(session.id, session.status);
      result.failures += 1;
    }
  }

  private async purgeTemporaryAsset(
    asset: MediaCleanupObject,
    now: Date,
    result: MediaCleanupResult,
  ): Promise<void> {
    if (!(await this.repository.claimTemporaryAsset(asset.id, now))) return;
    try {
      await this.storage.delete(asset.objectKey);
      await this.repository.recordCleanup(
        asset.tenantId,
        asset.id,
        'media.asset.purged',
        asset.objectKey,
      );
      result.purgedTemporaryAssets += 1;
    } catch {
      await this.repository.restoreTemporaryAsset(asset.id);
      result.failures += 1;
    }
  }

  private async purgeDeletedAsset(
    asset: MediaCleanupObject,
    now: Date,
    result: MediaCleanupResult,
  ): Promise<void> {
    if (!(await this.repository.claimDeletedAsset(asset.id, now))) return;
    try {
      await this.storage.delete(asset.objectKey);
      await this.repository.recordCleanup(
        asset.tenantId,
        asset.id,
        'media.asset.purged',
        asset.objectKey,
      );
      result.purgedDeletedAssets += 1;
    } catch {
      await this.repository.restoreDeletedAsset(asset.id);
      result.failures += 1;
    }
  }
}

function policyFromEnvironment(): MediaCleanupPolicy {
  return new MediaCleanupPolicy({
    temporaryRetentionHours: Number(process.env.MEDIA_TEMPORARY_RETENTION_HOURS ?? 168),
    deletedRetentionHours: Number(process.env.MEDIA_DELETED_RETENTION_HOURS ?? 720),
    batchSize: Number(process.env.MEDIA_CLEANUP_BATCH_SIZE ?? 100),
  });
}
