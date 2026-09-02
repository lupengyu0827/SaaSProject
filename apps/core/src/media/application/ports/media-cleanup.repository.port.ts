/** 媒体清理仓储端口：隔离清理用例与 Prisma，实现可替换和可测试。 */
export const MEDIA_CLEANUP_REPOSITORY = Symbol('MEDIA_CLEANUP_REPOSITORY');

export interface MediaCleanupObject {
  id: string;
  tenantId: string;
  objectKey: string;
  status: string;
}

export interface MediaCleanupRepository {
  findExpiredSessions(now: Date, limit: number): Promise<MediaCleanupObject[]>;
  claimExpiredSession(id: string, now: Date): Promise<boolean>;
  restoreExpiredSession(id: string, status: string): Promise<void>;
  findExpiredTemporaryAssets(cutoff: Date, limit: number): Promise<MediaCleanupObject[]>;
  claimTemporaryAsset(id: string, now: Date): Promise<boolean>;
  restoreTemporaryAsset(id: string): Promise<void>;
  findDeletedAssets(cutoff: Date, limit: number): Promise<MediaCleanupObject[]>;
  claimDeletedAsset(id: string, now: Date): Promise<boolean>;
  restoreDeletedAsset(id: string): Promise<void>;
  recordCleanup(
    tenantId: string,
    resourceId: string,
    action: 'media.session.expired' | 'media.asset.purged',
    objectKey: string,
  ): Promise<void>;
}
