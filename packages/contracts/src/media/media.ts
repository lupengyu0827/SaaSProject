/** 媒体上传契约：商品、回收、售后凭证和店铺素材共享。 */
export type MediaPurpose = 'product' | 'recycling' | 'after_sale' | 'store_branding';
export type MediaMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4';
export type MediaUploadStatus = 'initiated' | 'uploaded' | 'confirmed' | 'expired' | 'canceled';
export type MediaAssetStatus = 'temporary' | 'attached' | 'deleted';

export enum MediaErrorCode {
  UNSUPPORTED_MIME_TYPE = 'MEDIA_UNSUPPORTED_MIME_TYPE',
  FILE_TOO_LARGE = 'MEDIA_FILE_TOO_LARGE',
  SESSION_NOT_FOUND = 'MEDIA_SESSION_NOT_FOUND',
  SESSION_EXPIRED = 'MEDIA_SESSION_EXPIRED',
  UPLOAD_MISMATCH = 'MEDIA_UPLOAD_MISMATCH',
  OBJECT_MISSING = 'MEDIA_OBJECT_MISSING',
  HASH_MISMATCH = 'MEDIA_HASH_MISMATCH',
  ASSET_NOT_FOUND = 'MEDIA_ASSET_NOT_FOUND',
}

export interface CreateMediaUploadSessionRequest {
  purpose: MediaPurpose;
  fileName: string;
  mimeType: MediaMimeType;
  sizeBytes: number;
}

export interface MediaUploadSessionResponse {
  id: string;
  purpose: MediaPurpose;
  status: MediaUploadStatus;
  uploadUrl: string;
  expiresAt: string;
  maxSizeBytes: number;
}

export interface ConfirmMediaUploadRequest {
  sha256?: string;
}

export interface MediaAssetResponse {
  id: string;
  purpose: MediaPurpose;
  status: MediaAssetStatus;
  url: string;
  mimeType: MediaMimeType;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
}

export interface MediaUploadLimitsResponse {
  allowedMimeTypes: MediaMimeType[];
  maxFileSizeBytes: number;
  maxBatchFiles: number;
  sessionTtlSeconds: number;
}

export interface MediaAdminListQuery {
  status?: MediaAssetStatus;
  page?: number;
  pageSize?: number;
}

export interface MediaAdminListItem {
  id: string;
  tenantId: string;
  purpose: MediaPurpose;
  status: MediaAssetStatus;
  mimeType: MediaMimeType;
  sizeBytes: number;
  createdAt: string;
  deletedAt: string | null;
  purgedAt: string | null;
}

export interface MediaAdminListResponse {
  list: MediaAdminListItem[];
  total: number;
  page: number;
  pageSize: number;
}
