/** 媒体持久化端口：隔离 Application 与 Prisma，并封装事务、审计、事件和用量落库。 */
import type {
  MediaAdminListQuery,
  MediaAdminListResponse,
  MediaAssetResponse,
  MediaMimeType,
  MediaPurpose,
} from '@saas/contracts';

export const MEDIA_REPOSITORY = Symbol('MEDIA_REPOSITORY');

export interface MediaUploadSessionRecord {
  id: string;
  tenantId: string;
  actorId: string;
  purpose: MediaPurpose;
  objectKey: string;
  fileName: string;
  mimeType: MediaMimeType;
  sizeBytes: number;
  status: string;
  expiresAt: Date;
}

export interface MediaReadableAsset {
  objectKey: string;
  mimeType: string;
}

export interface ConfirmedMediaInput {
  tenantId: string;
  actorId: string;
  session: MediaUploadSessionRecord;
  sizeBytes: number;
  sha256: string;
}

export interface MediaRepository {
  createSession(session: MediaUploadSessionRecord): Promise<void>;
  findOwnedSession(
    tenantId: string,
    actorId: string,
    id: string,
  ): Promise<MediaUploadSessionRecord | null>;
  markUploaded(tenantId: string, id: string): Promise<MediaUploadSessionRecord>;
  markExpired(tenantId: string, id: string): Promise<void>;
  findAssetBySession(tenantId: string, sessionId: string): Promise<MediaAssetResponse | null>;
  confirmUpload(input: ConfirmedMediaInput): Promise<MediaAssetResponse>;
  findReadableAsset(tenantId: string, assetId: string): Promise<MediaReadableAsset | null>;
  findPublicAsset(tenantId: string, assetId: string): Promise<MediaReadableAsset | null>;
  listForAdmin(tenantId: string, query: MediaAdminListQuery): Promise<MediaAdminListResponse>;
}
