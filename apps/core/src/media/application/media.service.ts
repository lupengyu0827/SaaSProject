/** 媒体应用服务：编排上传、确认、读取与监管，不依赖具体数据库实现。 */
import { randomUUID } from 'node:crypto';

import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ConfirmMediaUploadRequest,
  CreateMediaUploadSessionRequest,
  MediaAdminListQuery,
  MediaAdminListResponse,
  MediaAssetResponse,
  MediaMimeType,
  MediaUploadLimitsResponse,
  MediaUploadSessionResponse,
} from '@saas/contracts';
import { MediaErrorCode } from '@saas/contracts';

import {
  MEDIA_STORAGE_PORT,
  type MediaStoragePort,
} from '../../shared/ports/media-storage.port.js';
import {
  MEDIA_REPOSITORY,
  type MediaRepository,
  type MediaUploadSessionRecord,
} from './ports/media.repository.port.js';

const ALLOWED_MIME_TYPES: MediaMimeType[] = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_BATCH_FILES = 20;
const SESSION_TTL_SECONDS = 30 * 60;

@Injectable()
export class MediaService {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly repository: MediaRepository,
    @Inject(MEDIA_STORAGE_PORT) private readonly storage: MediaStoragePort,
  ) {}

  limits(): MediaUploadLimitsResponse {
    return {
      allowedMimeTypes: ALLOWED_MIME_TYPES,
      maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
      maxBatchFiles: MAX_BATCH_FILES,
      sessionTtlSeconds: SESSION_TTL_SECONDS,
    };
  }

  listForAdmin(tenantId: string, query: MediaAdminListQuery): Promise<MediaAdminListResponse> {
    return this.repository.listForAdmin(tenantId, query);
  }

  async createSession(
    tenantId: string,
    actorId: string,
    input: CreateMediaUploadSessionRequest,
  ): Promise<MediaUploadSessionResponse> {
    this.assertInput(input);
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    const session: MediaUploadSessionRecord = {
      id,
      tenantId,
      actorId,
      purpose: input.purpose,
      objectKey: `${tenantId}/${input.purpose}/${id}.${extensionFor(input.mimeType)}`,
      fileName: input.fileName.slice(0, 200),
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      status: 'initiated',
      expiresAt,
    };
    await this.repository.createSession(session);
    return sessionResponse(session);
  }

  async upload(
    tenantId: string,
    actorId: string,
    sessionId: string,
    mimeType: string,
    content: Buffer,
  ): Promise<MediaUploadSessionResponse> {
    const session = await this.getOwnedSession(tenantId, actorId, sessionId);
    this.assertUpload(session, mimeType, content.byteLength);
    await this.storage.put(session.objectKey, content);
    return sessionResponse(await this.repository.markUploaded(tenantId, session.id));
  }

  async confirm(
    tenantId: string,
    actorId: string,
    sessionId: string,
    input: ConfirmMediaUploadRequest,
  ): Promise<MediaAssetResponse> {
    const session = await this.getOwnedSession(tenantId, actorId, sessionId);
    if (!['uploaded', 'confirmed'].includes(session.status)) {
      throw mediaConflict(MediaErrorCode.UPLOAD_MISMATCH, '图片尚未上传完成');
    }
    const existing = await this.repository.findAssetBySession(tenantId, sessionId);
    if (existing) return existing;
    const stored = await this.storage.stat(session.objectKey);
    if (!stored || stored.sizeBytes !== session.sizeBytes) {
      throw mediaConflict(MediaErrorCode.OBJECT_MISSING, '图片大小校验失败');
    }
    if (input.sha256 && input.sha256 !== stored.sha256) {
      throw mediaConflict(MediaErrorCode.HASH_MISMATCH, '图片哈希校验失败');
    }
    return this.repository.confirmUpload({
      tenantId,
      actorId,
      session,
      sizeBytes: stored.sizeBytes,
      sha256: stored.sha256,
    });
  }

  async read(tenantId: string, assetId: string): Promise<{ content: Buffer; mimeType: string }> {
    const asset = await this.repository.findReadableAsset(tenantId, assetId);
    if (!asset) throw mediaNotFound(MediaErrorCode.ASSET_NOT_FOUND, '媒体资源不存在');
    return { content: await this.storage.read(asset.objectKey), mimeType: asset.mimeType };
  }

  async readPublic(
    tenantId: string,
    assetId: string,
  ): Promise<{ content: Buffer; mimeType: string }> {
    const asset = await this.repository.findPublicAsset(tenantId, assetId);
    if (!asset) throw mediaNotFound(MediaErrorCode.ASSET_NOT_FOUND, '公开媒体资源不存在');
    return { content: await this.storage.read(asset.objectKey), mimeType: asset.mimeType };
  }

  private async getOwnedSession(
    tenantId: string,
    actorId: string,
    id: string,
  ): Promise<MediaUploadSessionRecord> {
    const session = await this.repository.findOwnedSession(tenantId, actorId, id);
    if (!session) throw mediaNotFound(MediaErrorCode.SESSION_NOT_FOUND, '上传会话不存在');
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.repository.markExpired(tenantId, id);
      throw mediaConflict(MediaErrorCode.SESSION_EXPIRED, '上传会话已过期');
    }
    return session;
  }

  private assertInput(input: CreateMediaUploadSessionRequest): void {
    if (!ALLOWED_MIME_TYPES.includes(input.mimeType)) {
      throw mediaConflict(MediaErrorCode.UNSUPPORTED_MIME_TYPE, '不支持该图片格式');
    }
    if (
      !Number.isSafeInteger(input.sizeBytes) ||
      input.sizeBytes <= 0 ||
      input.sizeBytes > MAX_FILE_SIZE_BYTES
    ) {
      throw mediaConflict(MediaErrorCode.FILE_TOO_LARGE, '单张图片不能超过 10MB');
    }
    if (!input.fileName.trim()) {
      throw mediaConflict(MediaErrorCode.UPLOAD_MISMATCH, '文件名不能为空');
    }
  }

  private assertUpload(
    session: Pick<MediaUploadSessionRecord, 'status' | 'expiresAt' | 'mimeType' | 'sizeBytes'>,
    mimeType: string,
    sizeBytes: number,
  ): void {
    if (session.status !== 'initiated') {
      throw mediaConflict(MediaErrorCode.UPLOAD_MISMATCH, '上传会话状态不允许再次上传');
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw mediaConflict(MediaErrorCode.SESSION_EXPIRED, '上传会话已过期');
    }
    if (mimeType !== session.mimeType || sizeBytes !== session.sizeBytes) {
      throw mediaConflict(MediaErrorCode.UPLOAD_MISMATCH, '图片类型或大小与上传会话不一致');
    }
  }
}

function extensionFor(mimeType: MediaMimeType): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  return 'webp';
}

function sessionResponse(
  session: Pick<MediaUploadSessionRecord, 'id' | 'purpose' | 'status' | 'expiresAt'>,
): MediaUploadSessionResponse {
  return {
    id: session.id,
    purpose: session.purpose,
    status: session.status as MediaUploadSessionResponse['status'],
    uploadUrl: `/api/media/upload-sessions/${session.id}/content`,
    expiresAt: session.expiresAt.toISOString(),
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
  };
}

function mediaConflict(code: MediaErrorCode, message: string): ConflictException {
  return new ConflictException({ code, message });
}

function mediaNotFound(code: MediaErrorCode, message: string): NotFoundException {
  return new NotFoundException({ code, message });
}
