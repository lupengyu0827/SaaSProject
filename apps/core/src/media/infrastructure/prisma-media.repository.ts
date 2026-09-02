/** Prisma 媒体仓储：实现租户过滤、事务、审计、事件和存储用量落库。 */
import { Injectable } from '@nestjs/common';
import type {
  MediaAdminListQuery,
  MediaAdminListResponse,
  MediaAssetResponse,
  MediaMimeType,
} from '@saas/contracts';

import { Prisma, type MediaAsset } from '../../generated/prisma/index.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import type {
  ConfirmedMediaInput,
  MediaReadableAsset,
  MediaRepository,
  MediaUploadSessionRecord,
} from '../application/ports/media.repository.port.js';

@Injectable()
export class PrismaMediaRepository implements MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(session: MediaUploadSessionRecord): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await setTenant(tx, session.tenantId);
      await tx.mediaUploadSession.create({ data: session });
      await recordEvent(
        tx,
        session.tenantId,
        session.actorId,
        'media.upload.initiated',
        session.id,
        {
          purpose: session.purpose,
          sizeBytes: session.sizeBytes,
        },
      );
    });
  }

  findOwnedSession(
    tenantId: string,
    actorId: string,
    id: string,
  ): Promise<MediaUploadSessionRecord | null> {
    return this.prisma.mediaUploadSession.findFirst({
      where: { id, tenantId, actorId },
    }) as Promise<MediaUploadSessionRecord | null>;
  }

  markUploaded(tenantId: string, id: string): Promise<MediaUploadSessionRecord> {
    return this.prisma.mediaUploadSession.update({
      where: { id, tenantId },
      data: { status: 'uploaded' },
    }) as Promise<MediaUploadSessionRecord>;
  }

  async markExpired(tenantId: string, id: string): Promise<void> {
    await this.prisma.mediaUploadSession.update({
      where: { id, tenantId },
      data: { status: 'expired' },
    });
  }

  async findAssetBySession(
    tenantId: string,
    sessionId: string,
  ): Promise<MediaAssetResponse | null> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { tenantId, uploadSessionId: sessionId },
    });
    return asset ? assetResponse(asset) : null;
  }

  confirmUpload(input: ConfirmedMediaInput): Promise<MediaAssetResponse> {
    return this.prisma.$transaction(async (tx) => {
      await setTenant(tx, input.tenantId);
      const asset = await tx.mediaAsset.create({
        data: {
          tenantId: input.tenantId,
          uploadSessionId: input.session.id,
          createdBy: input.actorId,
          purpose: input.session.purpose,
          objectKey: input.session.objectKey,
          mimeType: input.session.mimeType,
          sizeBytes: input.sizeBytes,
          sha256: input.sha256,
        },
      });
      await tx.mediaUploadSession.update({
        where: { id: input.session.id, tenantId: input.tenantId },
        data: { status: 'confirmed' },
      });
      await recordEvent(tx, input.tenantId, input.actorId, 'media.upload.confirmed', asset.id, {
        purpose: input.session.purpose,
        sizeBytes: input.sizeBytes,
      });
      await recordStorageUsage(tx, input.tenantId, input.sizeBytes);
      return assetResponse(asset);
    });
  }

  async findReadableAsset(tenantId: string, assetId: string): Promise<MediaReadableAsset | null> {
    return this.prisma.mediaAsset.findFirst({
      where: { id: assetId, tenantId, deletedAt: null },
      select: { objectKey: true, mimeType: true },
    });
  }

  async findPublicAsset(tenantId: string, assetId: string): Promise<MediaReadableAsset | null> {
    return this.prisma.mediaAsset.findFirst({
      where: {
        id: assetId,
        tenantId,
        status: 'attached',
        deletedAt: null,
        productImage: { is: { deletedAt: null, product: { status: 'active', deletedAt: null } } },
      },
      select: { objectKey: true, mimeType: true },
    });
  }

  async listForAdmin(
    tenantId: string,
    query: MediaAdminListQuery,
  ): Promise<MediaAdminListResponse> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.MediaAssetWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [list, total] = await this.prisma.$transaction([
      this.prisma.mediaAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);
    return {
      list: list.map((asset) => ({
        id: asset.id,
        tenantId: asset.tenantId,
        purpose: asset.purpose as MediaAssetResponse['purpose'],
        status: asset.status as MediaAssetResponse['status'],
        mimeType: asset.mimeType as MediaMimeType,
        sizeBytes: asset.sizeBytes,
        createdAt: asset.createdAt.toISOString(),
        deletedAt: asset.deletedAt?.toISOString() ?? null,
        purgedAt: asset.purgedAt?.toISOString() ?? null,
      })),
      total,
      page,
      pageSize,
    };
  }
}

function assetResponse(asset: MediaAsset): MediaAssetResponse {
  return {
    id: asset.id,
    purpose: asset.purpose as MediaAssetResponse['purpose'],
    status: asset.status as MediaAssetResponse['status'],
    url: `/api/media/assets/${asset.id}/content`,
    mimeType: asset.mimeType as MediaMimeType,
    sizeBytes: asset.sizeBytes,
    sha256: asset.sha256,
    createdAt: asset.createdAt.toISOString(),
  };
}

function setTenant(tx: Prisma.TransactionClient, tenantId: string): Promise<number> {
  return tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
}

async function recordEvent(
  tx: Prisma.TransactionClient,
  tenantId: string,
  actorId: string,
  eventType: string,
  aggregateId: string,
  payload: Prisma.InputJsonValue,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId,
      actorId,
      actorType: 'merchant',
      action: eventType,
      resourceType: 'media',
      resourceId: aggregateId,
      diff: payload,
    },
  });
  await tx.domainEventOutbox.create({
    data: { tenantId, aggregateType: 'media', aggregateId, eventType, payload },
  });
}

function recordStorageUsage(
  tx: Prisma.TransactionClient,
  tenantId: string,
  amount: number,
): Promise<unknown> {
  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);
  const periodEnd = new Date(periodStart);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
  periodEnd.setUTCDate(0);
  return tx.usageMetric.upsert({
    where: {
      tenantId_metricKey_periodStart: { tenantId, metricKey: 'storage_bytes', periodStart },
    },
    create: { tenantId, metricKey: 'storage_bytes', amount, periodStart, periodEnd },
    update: { amount: { increment: amount } },
  });
}
