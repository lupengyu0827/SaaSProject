/** Prisma 媒体清理仓储：原子认领候选并持久化审计与领域事件。 */
import { Inject, Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import type {
  MediaCleanupObject,
  MediaCleanupRepository,
} from '../application/ports/media-cleanup.repository.port.js';

@Injectable()
export class PrismaMediaCleanupRepository implements MediaCleanupRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findExpiredSessions(now: Date, limit: number): Promise<MediaCleanupObject[]> {
    return this.prisma.mediaUploadSession.findMany({
      where: { status: { in: ['initiated', 'uploaded'] }, expiresAt: { lte: now } },
      select: { id: true, tenantId: true, objectKey: true, status: true },
      orderBy: { expiresAt: 'asc' },
      take: limit,
    });
  }

  async claimExpiredSession(id: string, now: Date): Promise<boolean> {
    const result = await this.prisma.mediaUploadSession.updateMany({
      where: { id, status: { in: ['initiated', 'uploaded'] }, expiresAt: { lte: now } },
      data: { status: 'expired' },
    });
    return result.count === 1;
  }

  async restoreExpiredSession(id: string, status: string): Promise<void> {
    if (!['initiated', 'uploaded'].includes(status)) return;
    await this.prisma.mediaUploadSession.updateMany({
      where: { id, status: 'expired' },
      data: { status },
    });
  }

  findExpiredTemporaryAssets(cutoff: Date, limit: number): Promise<MediaCleanupObject[]> {
    return this.prisma.mediaAsset.findMany({
      where: { status: 'temporary', createdAt: { lte: cutoff }, purgedAt: null },
      select: { id: true, tenantId: true, objectKey: true, status: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async claimTemporaryAsset(id: string, now: Date): Promise<boolean> {
    const result = await this.prisma.mediaAsset.updateMany({
      where: { id, status: 'temporary', purgedAt: null },
      data: { status: 'deleted', deletedAt: now, purgedAt: now },
    });
    return result.count === 1;
  }

  async restoreTemporaryAsset(id: string): Promise<void> {
    await this.prisma.mediaAsset.updateMany({
      where: { id, status: 'deleted', purgedAt: { not: null } },
      data: { status: 'temporary', deletedAt: null, purgedAt: null },
    });
  }

  findDeletedAssets(cutoff: Date, limit: number): Promise<MediaCleanupObject[]> {
    return this.prisma.mediaAsset.findMany({
      where: { status: 'deleted', deletedAt: { lte: cutoff }, purgedAt: null },
      select: { id: true, tenantId: true, objectKey: true, status: true },
      orderBy: { deletedAt: 'asc' },
      take: limit,
    });
  }

  async claimDeletedAsset(id: string, now: Date): Promise<boolean> {
    const result = await this.prisma.mediaAsset.updateMany({
      where: { id, status: 'deleted', purgedAt: null },
      data: { purgedAt: now },
    });
    return result.count === 1;
  }

  async restoreDeletedAsset(id: string): Promise<void> {
    await this.prisma.mediaAsset.updateMany({
      where: { id, status: 'deleted', purgedAt: { not: null } },
      data: { purgedAt: null },
    });
  }

  async recordCleanup(
    tenantId: string,
    resourceId: string,
    action: 'media.session.expired' | 'media.asset.purged',
    objectKey: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      const payload = { objectKey } satisfies Prisma.InputJsonObject;
      await tx.auditLog.create({
        data: {
          tenantId,
          actorType: 'system',
          action,
          resourceType: 'media',
          resourceId,
          diff: payload,
        },
      });
      await tx.domainEventOutbox.create({
        data: {
          tenantId,
          aggregateType: 'media',
          aggregateId: resourceId,
          eventType: action,
          payload,
        },
      });
    });
  }
}
