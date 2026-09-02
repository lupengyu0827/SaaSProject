<script setup lang="ts">
/** 手机媒体上传页：持久化队列、进度、取消和失败项重试。 */
import type { MediaMimeType } from '@saas/contracts';
import { computed, onMounted, ref } from 'vue';

import {
  confirmMediaUpload,
  createMediaUploadSession,
  uploadMediaFile,
} from '../../api/modules/media.api';
import {
  restoreUploadQueue,
  selectRetryableItems,
  type UploadQueueItem,
} from '../../composables/media-upload-queue';

const STORAGE_KEY = 'saas.merchant.mediaUploadQueue';
const MAX_QUEUE_FILES = 20;
const queue = ref<UploadQueueItem[]>([]);
interface ChosenMediaResult {
  tempFiles: Array<{ tempFilePath: string; size: number }>;
}
interface AbortableUploadTask {
  abort(): void;
}

const activeTasks = new Map<string, AbortableUploadTask>();
const canceledIds = new Set<string>();
const uploading = computed(() => queue.value.some(({ status }) => status === 'uploading'));
const completedCount = computed(
  () => queue.value.filter(({ status }) => status === 'uploaded').length,
);

/** 从相机或相册选择图片并保存为可恢复的本地文件。 */
async function handleChoose(): Promise<void> {
  const remaining = MAX_QUEUE_FILES - queue.value.length;
  if (remaining <= 0) {
    void uni.showToast({ title: '单批最多选择 20 张', icon: 'none' });
    return;
  }
  const selected = await chooseMediaFiles(Math.min(9, remaining));
  for (const file of selected.tempFiles) {
    const savedFilePath = await savePersistentFile(file.tempFilePath);
    queue.value.push(createItem(savedFilePath, file.size));
  }
  persistQueue();
}

/** 使用微信文件系统 API 持久化临时图片，避免已弃用的 wx.saveFile。 */
function savePersistentFile(tempFilePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.getFileSystemManager().saveFile({
      tempFilePath,
      success: ({ savedFilePath }) => resolve(savedFilePath),
      fail: reject,
    });
  });
}

/** 上传所有待处理或失败项；每项拥有独立状态，不重复上传已成功资源。 */
async function handleUploadAll(): Promise<void> {
  const candidates = selectRetryableItems(queue.value);
  for (const item of candidates) await uploadOne(item);
  if (candidates.length) {
    void uni.showToast({ title: `已完成 ${completedCount.value} 张`, icon: 'success' });
  }
}

/** 只重试指定失败项。 */
async function handleRetry(item: UploadQueueItem): Promise<void> {
  await uploadOne(item);
}

/** 取消上传中的任务，或从队列移除未上传文件。 */
function handleCancel(item: UploadQueueItem): void {
  activeTasks.get(item.id)?.abort();
  activeTasks.delete(item.id);
  canceledIds.add(item.id);
  item.status = 'canceled';
  item.errorMessage = '已取消';
  persistQueue();
}

/** 清理本次已上传完成的队列展示，不删除服务端资产。 */
function handleClearCompleted(): void {
  queue.value = queue.value.filter(({ status }) => status !== 'uploaded');
  persistQueue();
}

async function uploadOne(item: UploadQueueItem): Promise<void> {
  item.status = 'uploading';
  canceledIds.delete(item.id);
  item.progress = 0;
  item.errorMessage = undefined;
  persistQueue();
  try {
    const session = await createMediaUploadSession({
      purpose: 'product',
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
    });
    const upload = uploadMediaFile(session, item.filePath, (progress) => {
      item.progress = progress;
    });
    activeTasks.set(item.id, upload.task);
    await upload.result;
    const asset = await confirmMediaUpload(session.id);
    item.assetId = asset.id;
    item.status = 'uploaded';
    item.progress = 100;
  } catch (error: unknown) {
    item.status = canceledIds.has(item.id) ? 'canceled' : 'failed';
    item.errorMessage = error instanceof Error ? error.message : '上传失败';
  } finally {
    activeTasks.delete(item.id);
    persistQueue();
  }
}

function chooseMediaFiles(count: number): Promise<ChosenMediaResult> {
  return new Promise((resolve, reject) => {
    void uni.chooseMedia({
      count,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: resolve,
      fail: reject,
    });
  });
}

function createItem(filePath: string, sizeBytes: number): UploadQueueItem {
  const suffix = filePath.split('.').pop()?.toLowerCase();
  const mimeType: MediaMimeType =
    suffix === 'png' ? 'image/png' : suffix === 'webp' ? 'image/webp' : 'image/jpeg';
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    filePath,
    fileName: filePath.split('/').pop() ?? `image-${Date.now()}.jpg`,
    mimeType,
    sizeBytes,
    status: 'pending',
    progress: 0,
  };
}

function persistQueue(): void {
  uni.setStorageSync(STORAGE_KEY, queue.value);
}

onMounted(() => {
  queue.value = restoreUploadQueue(uni.getStorageSync<unknown>(STORAGE_KEY));
});
</script>

<template>
  <view class="page-shell">
    <view class="summary">
      <text class="title">商品图片上传</text>
      <text class="description">支持拍照、相册多选、失败重试与退出后恢复</text>
      <text class="counter">{{ completedCount }} / {{ queue.length }} 已上传</text>
    </view>

    <view class="actions">
      <button class="secondary" :disabled="uploading" @click="handleChoose">拍照或选择图片</button>
      <button
        class="primary"
        :loading="uploading"
        :disabled="uploading || queue.length === 0"
        @click="handleUploadAll"
      >
        上传待处理图片
      </button>
    </view>

    <view v-if="queue.length === 0" class="empty">尚未选择图片，单批最多 20 张</view>
    <view v-for="item in queue" :key="item.id" class="queue-row">
      <image class="preview" :src="item.filePath" mode="aspectFill" />
      <view class="queue-copy">
        <text class="file-name">{{ item.fileName }}</text>
        <text class="status">{{ item.status }} · {{ item.progress }}%</text>
        <text v-if="item.errorMessage" class="error">{{ item.errorMessage }}</text>
      </view>
      <button
        v-if="item.status === 'failed' || item.status === 'canceled'"
        class="row-action"
        @click="handleRetry(item)"
      >
        重试
      </button>
      <button v-else-if="item.status !== 'uploaded'" class="row-action" @click="handleCancel(item)">
        取消
      </button>
    </view>

    <button v-if="completedCount > 0" class="clear" @click="handleClearCompleted">
      清除已完成记录
    </button>
  </view>
</template>

<style scoped lang="scss">
@use '../../styles/tokens.scss' as *;

.page-shell {
  min-height: 100vh;
  padding: 40rpx 32rpx;
  background: $bg-base;
}
.summary,
.queue-copy {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.title {
  color: $text-primary;
  font-size: 42rpx;
  font-weight: 600;
}
.description,
.status,
.empty {
  color: $text-secondary;
  font-size: 26rpx;
  line-height: 1.6;
}
.counter {
  color: $accent-gold;
  font-size: 24rpx;
}
.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  margin: 40rpx 0 24rpx;
}
.primary,
.secondary,
.clear,
.row-action {
  border-radius: 16rpx;
  font-size: 26rpx;
}
.primary {
  background: $accent-gold;
  color: $bg-surface;
}
.secondary,
.clear,
.row-action {
  border: 2rpx solid $border-subtle;
  background: $bg-surface;
  color: $text-primary;
}
.primary::after,
.secondary::after,
.clear::after,
.row-action::after {
  border: 0;
}
.empty {
  padding: 40rpx 24rpx;
  text-align: center;
}
.queue-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx 0;
  border-bottom: 2rpx solid $border-subtle;
}
.preview {
  width: 112rpx;
  height: 112rpx;
  flex: 0 0 auto;
  border-radius: 12rpx;
  background: $bg-surface;
}
.queue-copy {
  min-width: 0;
  flex: 1;
}
.file-name {
  overflow: hidden;
  color: $text-primary;
  font-size: 25rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.error {
  color: #be123c;
  font-size: 22rpx;
}
.row-action {
  width: 112rpx;
  margin: 0;
  padding: 0;
  white-space: nowrap;
}
.clear {
  margin-top: 32rpx;
}
</style>
