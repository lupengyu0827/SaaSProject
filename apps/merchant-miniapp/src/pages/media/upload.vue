<!-- 手机媒体上传页：持久化队列、进度、取消和失败项重试，视觉与消费者端对齐。 -->
<script setup lang="ts">
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
import { useAppTheme } from '../../composables/use-app-theme';

const { themeClass } = useAppTheme();
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

/** 状态图标路径映射。 */
function statusIcon(status: UploadQueueItem['status']): string | null {
  switch (status) {
    case 'uploaded':
      return '/static/merchant/check-circle.svg';
    case 'failed':
      return '/static/merchant/alert-circle.svg';
    case 'canceled':
      return '/static/merchant/x-circle.svg';
    case 'uploading':
      return '/static/merchant/upload-cloud.svg';
    default:
      return '/static/merchant/image.svg';
  }
}

onMounted(() => {
  queue.value = restoreUploadQueue(uni.getStorageSync<unknown>(STORAGE_KEY));
});
</script>

<template>
  <view class="page" :class="themeClass">
    <view class="page-header">
      <text class="eyebrow">MEDIA UPLOAD</text>
      <text class="title">商品图片上传</text>
      <text class="description">支持拍照、相册多选、失败重试与退出后恢复</text>
      <text class="counter">{{ completedCount }} / {{ queue.length }} 已上传</text>
    </view>

    <view class="actions">
      <button class="btn-secondary" :disabled="uploading" @click="handleChoose">
        <image class="btn-icon" src="/static/merchant/camera.svg" mode="aspectFit" />
        <text>拍照或选择图片</text>
      </button>
      <button
        class="btn-primary"
        :loading="uploading"
        :disabled="uploading || queue.length === 0"
        @click="handleUploadAll"
      >
        上传待处理图片
      </button>
    </view>

    <view v-if="queue.length === 0" class="empty-state">
      <image class="empty-icon" src="/static/merchant/upload-cloud.svg" mode="aspectFit" />
      <text class="empty-text">尚未选择图片，单批最多 20 张</text>
    </view>

    <view v-for="item in queue" :key="item.id" class="queue-card">
      <image class="queue-preview" :src="item.filePath" mode="aspectFill" />
      <view class="queue-copy">
        <text class="file-name">{{ item.fileName }}</text>
        <view v-if="item.status === 'uploading'" class="progress-bar">
          <view class="progress-fill" :style="{ width: `${item.progress}%` }" />
        </view>
        <view class="status-row">
          <image
            v-if="statusIcon(item.status)"
            class="status-icon"
            :src="statusIcon(item.status) ?? ''"
            mode="aspectFit"
          />
          <text class="status-text" :class="{ 'status-error': item.status === 'failed' }">
            {{ item.status }} · {{ item.progress }}%
          </text>
        </view>
        <text v-if="item.errorMessage" class="error-text">{{ item.errorMessage }}</text>
      </view>
      <view class="queue-actions">
        <view
          v-if="item.status === 'failed' || item.status === 'canceled'"
          class="action-btn retry"
          @click="handleRetry(item)"
        >
          <image class="action-icon" src="/static/merchant/refresh-cw.svg" mode="aspectFit" />
        </view>
        <view
          v-else-if="item.status !== 'uploaded'"
          class="action-btn cancel"
          @click="handleCancel(item)"
        >
          <image class="action-icon" src="/static/merchant/x-circle.svg" mode="aspectFit" />
        </view>
      </view>
    </view>

    <view v-if="completedCount > 0" class="clear-btn" @click="handleClearCompleted">
      清除已完成记录
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '../../styles/tokens.scss';
.page {
  min-height: 100vh;
  padding: 24rpx 32rpx 48rpx;
  color: var(--theme-text);
  background: var(--theme-bg);
}
.page-header {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.eyebrow {
  color: var(--theme-accent);
  font-family: $font-mono;
  font-size: 20rpx;
  letter-spacing: 4rpx;
}
.title {
  color: var(--theme-text);
  font-family: $font-display;
  font-size: 42rpx;
  font-weight: 700;
}
.description {
  color: var(--theme-text-secondary);
  font-size: 26rpx;
  line-height: 1.6;
}
.counter {
  color: var(--theme-accent);
  font-family: $font-mono;
  font-size: 24rpx;
  font-weight: 600;
}
.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  margin: 32rpx 0 24rpx;
}
.btn-secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  border: 1rpx solid var(--theme-border);
  border-radius: $radius-control;
  background: var(--theme-surface);
  color: var(--theme-text);
  font-size: 26rpx;
  line-height: 80rpx;
}
.btn-secondary::after {
  border: 0;
}
.btn-icon {
  width: 28rpx;
  height: 28rpx;
}
.btn-primary {
  border-radius: 999rpx;
  background: var(--theme-accent);
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 600;
  line-height: 80rpx;
}
.btn-primary::after {
  border: 0;
}
.btn-primary[disabled] {
  opacity: 0.5;
}
.btn-secondary[disabled] {
  opacity: 0.5;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  padding: 64rpx 24rpx;
}
.empty-icon {
  width: 64rpx;
  height: 64rpx;
  opacity: 0.4;
}
.empty-text {
  color: var(--theme-text-muted);
  font-size: 26rpx;
}
.queue-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 16rpx;
  padding: 20rpx 24rpx;
  border-radius: $radius-card;
  background: var(--theme-surface);
  box-shadow: $shadow-luxury;
}
.queue-preview {
  width: 112rpx;
  height: 112rpx;
  flex: 0 0 auto;
  border-radius: $radius-control;
  background: var(--theme-border-soft);
}
.queue-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 10rpx;
}
.file-name {
  overflow: hidden;
  color: var(--theme-text);
  font-size: 25rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.progress-bar {
  height: 8rpx;
  border-radius: 4rpx;
  background: var(--theme-border-soft);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 4rpx;
  background: var(--theme-accent);
  transition: width 0.2s ease;
}
.status-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.status-icon {
  width: 24rpx;
  height: 24rpx;
}
.status-text {
  color: var(--theme-text-secondary);
  font-size: 22rpx;
}
.status-error {
  color: var(--theme-danger);
}
.error-text {
  color: var(--theme-danger);
  font-size: 22rpx;
}
.queue-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8rpx;
}
.action-btn {
  display: flex;
  width: 64rpx;
  height: 64rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}
.retry {
  background: var(--theme-accent-soft);
}
.cancel {
  background: var(--theme-border-soft);
}
.action-icon {
  width: 28rpx;
  height: 28rpx;
}
.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 24rpx;
  padding: 20rpx 0;
  border: 1rpx solid var(--theme-border);
  border-radius: $radius-control;
  background: var(--theme-surface);
  color: var(--theme-text-secondary);
  font-size: 24rpx;
}
</style>
