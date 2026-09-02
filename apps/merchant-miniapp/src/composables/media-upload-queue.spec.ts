/** 商家媒体上传队列测试：覆盖中断恢复、无效缓存和仅重试失败项。 */
import { describe, expect, it } from 'vitest';

import {
  restoreUploadQueue,
  selectRetryableItems,
  type UploadQueueItem,
} from './media-upload-queue';

describe('media upload queue', () => {
  it('restores interrupted uploading items as retryable failures', () => {
    const restored = restoreUploadQueue([
      item('uploading', 'interrupted'),
      item('uploaded', 'completed'),
    ]);

    expect(restored[0]).toMatchObject({
      id: 'interrupted',
      status: 'failed',
      errorMessage: '上次上传已中断，请重试',
    });
    expect(restored[1]).toMatchObject({ id: 'completed', status: 'uploaded' });
  });

  it('ignores malformed persisted records', () => {
    const restored = restoreUploadQueue([item('pending', 'valid'), { id: 'invalid' }, null]);

    expect(restored).toHaveLength(1);
    expect(restored[0]?.id).toBe('valid');
  });

  it('selects only pending and failed items for batch retry', () => {
    const queue: UploadQueueItem[] = [
      item('pending', 'pending'),
      item('failed', 'failed'),
      item('uploading', 'uploading'),
      item('uploaded', 'uploaded'),
      item('canceled', 'canceled'),
    ];

    expect(selectRetryableItems(queue).map(({ id }) => id)).toEqual(['pending', 'failed']);
  });
});

function item(status: UploadQueueItem['status'], id: string): UploadQueueItem {
  return {
    id,
    filePath: `wxfile://${id}.jpg`,
    fileName: `${id}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 100,
    status,
    progress: status === 'uploaded' ? 100 : 0,
  };
}
