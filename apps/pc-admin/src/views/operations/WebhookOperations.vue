<script setup lang="ts">
/** 回调死信运营页：安全展示摘要并触发经过审计的人工重放。 */
import { onMounted, shallowRef } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { WebhookDeadLetterResponse } from '@saas/contracts';

import { orderApi } from '../../api/modules/order.api.js';

const events = shallowRef<WebhookDeadLetterResponse[]>([]);
const loading = shallowRef(false);
const replayingId = shallowRef<string | null>(null);

async function handleLoad(): Promise<void> {
  loading.value = true;
  try {
    events.value = await orderApi.deadLetters();
  } catch (error: unknown) {
    ElMessage.error(error instanceof Error ? error.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

async function handleReplay(event: WebhookDeadLetterResponse): Promise<void> {
  await ElMessageBox.confirm(
    `确认重放 ${event.kind === 'payment' ? '支付' : '退款'}事件 ${event.eventId}？`,
    '人工重放',
  );
  replayingId.value = event.id;
  try {
    await orderApi.replayDeadLetter(event.kind, event.id);
    ElMessage.success('事件已恢复到待处理队列');
    await handleLoad();
  } catch (error: unknown) {
    ElMessage.error(error instanceof Error ? error.message : '重放失败');
  } finally {
    replayingId.value = null;
  }
}

onMounted(() => void handleLoad());
</script>

<template>
  <section aria-labelledby="webhooks-title" class="space-y-6">
    <div class="flex items-end justify-between gap-4">
      <div>
        <p class="text-sm font-medium text-accent">WEBHOOK INBOX</p>
        <h1 id="webhooks-title" class="mt-2 font-display text-3xl tracking-wide">回调异常中心</h1>
        <p class="mt-2 text-sm text-secondary">查看支付与退款死信，并执行可审计的人工重放。</p>
      </div>
      <el-button :loading="loading" @click="handleLoad">刷新数据</el-button>
    </div>
    <div class="overflow-hidden rounded-xl border border-subtle bg-surface shadow-luxury">
      <el-table v-loading="loading" :data="events" empty-text="当前没有死信事件">
        <el-table-column label="类型" width="100"
          ><template #default="{ row }"
            ><el-tag
              class="whitespace-nowrap"
              :type="row.kind === 'payment' ? 'success' : 'warning'"
              >{{ row.kind === 'payment' ? '支付' : '退款' }}</el-tag
            ></template
          ></el-table-column
        >
        <el-table-column prop="channel" label="渠道" width="130" />
        <el-table-column prop="eventId" label="事件 ID" min-width="220" show-overflow-tooltip />
        <el-table-column prop="attempts" label="重试次数" width="100" />
        <el-table-column prop="lastError" label="最后错误" min-width="260" show-overflow-tooltip />
        <el-table-column label="操作" width="110" fixed="right"
          ><template #default="{ row }"
            ><el-button
              link
              type="primary"
              :loading="replayingId === row.id"
              @click="handleReplay(row)"
              >人工重放</el-button
            ></template
          ></el-table-column
        >
      </el-table>
    </div>
  </section>
</template>
