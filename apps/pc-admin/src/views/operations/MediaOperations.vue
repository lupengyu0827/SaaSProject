<!-- 媒体监管页：查看当前租户媒体状态、归属与清理结果。 -->
<script setup lang="ts">
import type { MediaAdminListItem, MediaAssetStatus } from '@saas/contracts';
import { ElMessage } from 'element-plus';
import { computed, onMounted, shallowRef } from 'vue';

import { listMediaAssets } from '../../api/modules/media.api';

const assets = shallowRef<MediaAdminListItem[]>([]);
const loading = shallowRef(false);
const errorMessage = shallowRef('');
const total = shallowRef(0);
const page = shallowRef(1);
const pageSize = shallowRef(20);
const status = shallowRef<MediaAssetStatus | undefined>();

const emptyDescription = computed(() =>
  status.value ? '当前筛选条件下没有媒体资源' : '当前租户暂无媒体资源',
);

async function handleLoad(): Promise<void> {
  loading.value = true;
  errorMessage.value = '';
  try {
    const result = await listMediaAssets({
      page: page.value,
      pageSize: pageSize.value,
      status: status.value,
    });
    assets.value = result.list;
    total.value = result.total;
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '媒体数据加载失败';
    ElMessage.error(errorMessage.value);
  } finally {
    loading.value = false;
  }
}

function handleStatusChange(): void {
  page.value = 1;
  void handleLoad();
}

function handlePageChange(nextPage: number): void {
  page.value = nextPage;
  void handleLoad();
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusType(value: MediaAssetStatus): 'success' | 'warning' | 'info' {
  if (value === 'attached') return 'success';
  if (value === 'temporary') return 'warning';
  return 'info';
}

onMounted(() => void handleLoad());
</script>

<template>
  <section class="space-y-6">
    <header class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-[var(--pc-text-primary)]">媒体监管</h1>
        <p class="mt-2 text-sm text-[var(--pc-text-secondary)]">
          查看当前租户的临时、已绑定和已删除媒体；对象存储路径不会在页面暴露。
        </p>
      </div>
      <el-button :loading="loading" @click="handleLoad">刷新</el-button>
    </header>

    <div class="flex items-center gap-3 border-b border-[var(--pc-border)] pb-4">
      <span class="whitespace-nowrap text-sm text-[var(--pc-text-regular)]">媒体状态</span>
      <el-select
        v-model="status"
        class="w-48"
        clearable
        placeholder="全部状态"
        @change="handleStatusChange"
      >
        <el-option label="临时" value="temporary" />
        <el-option label="已绑定" value="attached" />
        <el-option label="已删除" value="deleted" />
      </el-select>
    </div>

    <el-alert v-if="errorMessage" :closable="false" :title="errorMessage" show-icon type="error" />

    <el-table v-loading="loading" :data="assets" empty-text="暂无媒体资源">
      <el-table-column label="资源 ID" min-width="240" prop="id" show-overflow-tooltip />
      <el-table-column label="用途" prop="purpose" width="130" />
      <el-table-column label="状态" width="110">
        <template #default="{ row }: { row: MediaAdminListItem }">
          <el-tag :type="statusType(row.status)" class="whitespace-nowrap">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="格式" prop="mimeType" width="140" />
      <el-table-column label="大小" width="110">
        <template #default="{ row }: { row: MediaAdminListItem }">
          {{ formatBytes(row.sizeBytes) }}
        </template>
      </el-table-column>
      <el-table-column label="创建时间" min-width="180" prop="createdAt" />
      <template #empty>
        <el-empty :description="emptyDescription" />
      </template>
    </el-table>

    <div class="flex justify-end">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="handlePageChange"
      />
    </div>
  </section>
</template>
