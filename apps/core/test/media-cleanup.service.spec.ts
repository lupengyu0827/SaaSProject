/** 媒体清理测试：覆盖保留期、幂等认领、物理删除和失败恢复。 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MediaCleanupService } from '../src/media/application/media-cleanup.service.js';
import type { MediaCleanupObject } from '../src/media/application/ports/media-cleanup.repository.port.js';
import { MediaCleanupPolicy } from '../src/media/domain/media-cleanup.policy.js';
import type { MediaStoragePort } from '../src/shared/ports/media-storage.port.js';

const NOW = new Date('2026-09-01T00:00:00.000Z');

interface MediaCleanupRepositoryMock {
  findExpiredSessions: ReturnType<typeof vi.fn>;
  claimExpiredSession: ReturnType<typeof vi.fn>;
  restoreExpiredSession: ReturnType<typeof vi.fn>;
  findExpiredTemporaryAssets: ReturnType<typeof vi.fn>;
  claimTemporaryAsset: ReturnType<typeof vi.fn>;
  restoreTemporaryAsset: ReturnType<typeof vi.fn>;
  findDeletedAssets: ReturnType<typeof vi.fn>;
  claimDeletedAsset: ReturnType<typeof vi.fn>;
  restoreDeletedAsset: ReturnType<typeof vi.fn>;
  recordCleanup: ReturnType<typeof vi.fn>;
}

interface MediaStoragePortMock extends MediaStoragePort {
  delete: ReturnType<typeof vi.fn>;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('MediaCleanupPolicy', () => {
  it('calculates temporary and deleted cutoffs with bounded batch size', () => {
    const policy = new MediaCleanupPolicy({
      temporaryRetentionHours: 24,
      deletedRetentionHours: 72,
      batchSize: 900,
    });

    expect(policy.temporaryCutoff(NOW).toISOString()).toBe('2026-08-31T00:00:00.000Z');
    expect(policy.deletedCutoff(NOW).toISOString()).toBe('2026-08-29T00:00:00.000Z');
    expect(policy.batchSize).toBe(500);
  });
});

describe('MediaCleanupService', () => {
  it('expires orphan sessions and purges temporary and delayed-deleted assets once', async () => {
    setPolicyEnvironment();
    const session = object('session-1', 'uploaded');
    const temporary = object('asset-temp', 'temporary');
    const deleted = object('asset-deleted', 'deleted');
    const repository = repositoryMock({ sessions: [session], temporary: [temporary], deleted: [deleted] });
    const storage = storageMock();

    const result = await new MediaCleanupService(repository, storage).run(NOW);

    expect(result).toEqual({
      expiredSessions: 1,
      purgedTemporaryAssets: 1,
      purgedDeletedAssets: 1,
      failures: 0,
    });
    expect(storage.delete).toHaveBeenCalledTimes(3);
    expect(repository.recordCleanup).toHaveBeenCalledTimes(3);
    expect(repository.restoreExpiredSession).not.toHaveBeenCalled();
    expect(repository.restoreTemporaryAsset).not.toHaveBeenCalled();
    expect(repository.restoreDeletedAsset).not.toHaveBeenCalled();
  });

  it('does not delete when another worker already claimed the candidate', async () => {
    setPolicyEnvironment();
    const repository = repositoryMock({ sessions: [object('session-1', 'initiated')] });
    vi.mocked(repository.claimExpiredSession).mockResolvedValue(false);
    const storage = storageMock();

    const result = await new MediaCleanupService(repository, storage).run(NOW);

    expect(result.expiredSessions).toBe(0);
    expect(storage.delete).not.toHaveBeenCalled();
    expect(repository.recordCleanup).not.toHaveBeenCalled();
  });

  it('restores claims when physical storage deletion fails', async () => {
    setPolicyEnvironment();
    const session = object('session-1', 'uploaded');
    const temporary = object('asset-temp', 'temporary');
    const deleted = object('asset-deleted', 'deleted');
    const repository = repositoryMock({ sessions: [session], temporary: [temporary], deleted: [deleted] });
    const storage = storageMock();
    vi.mocked(storage.delete).mockRejectedValue(new Error('storage unavailable'));

    const result = await new MediaCleanupService(repository, storage).run(NOW);

    expect(result.failures).toBe(3);
    expect(repository.restoreExpiredSession).toHaveBeenCalledWith('session-1', 'uploaded');
    expect(repository.restoreTemporaryAsset).toHaveBeenCalledWith('asset-temp');
    expect(repository.restoreDeletedAsset).toHaveBeenCalledWith('asset-deleted');
    expect(repository.recordCleanup).not.toHaveBeenCalled();
  });
});

function setPolicyEnvironment(): void {
  vi.stubEnv('MEDIA_TEMPORARY_RETENTION_HOURS', '24');
  vi.stubEnv('MEDIA_DELETED_RETENTION_HOURS', '72');
  vi.stubEnv('MEDIA_CLEANUP_BATCH_SIZE', '100');
}

function object(id: string, status: string): MediaCleanupObject {
  return { id, tenantId: 'tenant-1', objectKey: `tenant-1/product/${id}.jpg`, status };
}

function repositoryMock(input: {
  sessions?: MediaCleanupObject[];
  temporary?: MediaCleanupObject[];
  deleted?: MediaCleanupObject[];
}): MediaCleanupRepositoryMock {
  return {
    findExpiredSessions: vi.fn().mockResolvedValue(input.sessions ?? []),
    claimExpiredSession: vi.fn().mockResolvedValue(true),
    restoreExpiredSession: vi.fn().mockResolvedValue(undefined),
    findExpiredTemporaryAssets: vi.fn().mockResolvedValue(input.temporary ?? []),
    claimTemporaryAsset: vi.fn().mockResolvedValue(true),
    restoreTemporaryAsset: vi.fn().mockResolvedValue(undefined),
    findDeletedAssets: vi.fn().mockResolvedValue(input.deleted ?? []),
    claimDeletedAsset: vi.fn().mockResolvedValue(true),
    restoreDeletedAsset: vi.fn().mockResolvedValue(undefined),
    recordCleanup: vi.fn().mockResolvedValue(undefined),
  };
}

function storageMock(): MediaStoragePortMock {
  return {
    put: vi.fn(),
    stat: vi.fn(),
    read: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}
