/** 商家媒体上传队列规则：统一恢复中断状态并筛选可重试任务。 */
import type { MediaMimeType } from '@saas/contracts';

export type UploadQueueStatus = 'pending' | 'uploading' | 'uploaded' | 'failed' | 'canceled';

const MIME_TYPES: MediaMimeType[] = ['image/jpeg', 'image/png', 'image/webp'];
const QUEUE_STATUSES: UploadQueueStatus[] = [
  'pending',
  'uploading',
  'uploaded',
  'failed',
  'canceled',
];

export interface UploadQueueItem {
  id: string;
  filePath: string;
  fileName: string;
  mimeType: MediaMimeType;
  sizeBytes: number;
  status: UploadQueueStatus;
  progress: number;
  assetId?: string;
  errorMessage?: string;
}

/** 恢复持久化队列；进程中断时仍为 uploading 的任务转为失败，等待用户重试。 */
export function restoreUploadQueue(stored: unknown): UploadQueueItem[] {
  if (!Array.isArray(stored)) return [];
  return stored.filter(isUploadQueueItem).map((item) => ({
    ...item,
    status: item.status === 'uploading' ? 'failed' : item.status,
    errorMessage: item.status === 'uploading' ? '上次上传已中断，请重试' : item.errorMessage,
  }));
}

/** 返回可上传项，排除已成功、已取消和当前上传中的任务。 */
export function selectRetryableItems(queue: UploadQueueItem[]): UploadQueueItem[] {
  return queue.filter(({ status }) => status === 'pending' || status === 'failed');
}

function isUploadQueueItem(value: unknown): value is UploadQueueItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.filePath === 'string' &&
    typeof value.fileName === 'string' &&
    MIME_TYPES.includes(value.mimeType as MediaMimeType) &&
    typeof value.sizeBytes === 'number' &&
    Number.isSafeInteger(value.sizeBytes) &&
    value.sizeBytes > 0 &&
    QUEUE_STATUSES.includes(value.status as UploadQueueStatus) &&
    typeof value.progress === 'number' &&
    Number.isFinite(value.progress)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
