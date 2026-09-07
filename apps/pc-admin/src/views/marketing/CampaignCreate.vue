<script setup lang="ts">
/** 营销活动创建：分步表单 + 右侧实时预览。 */
import { computed, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';

type CampaignType = 'fullReduction' | 'discount' | 'gift';
type ScopeType = 'all' | 'category' | 'product';

interface CampaignDraft {
  name: string;
  type: CampaignType;
  dateRange: string[];
  threshold: string;
  reduction: string;
  discountRate: string;
  giftThreshold: string;
  giftCount: string;
  scope: ScopeType;
  categoryIds: string[];
  productKeyword: string;
  publishNote: string;
}

const steps = [
  { title: '基本信息', description: '活动名称与时间' },
  { title: '优惠规则', description: '门槛与优惠' },
  { title: '适用商品', description: '参与范围' },
  { title: '发布设置', description: '上线与说明' },
];

const typeLabels: Record<CampaignType, string> = {
  fullReduction: '满减',
  discount: '折扣',
  gift: '满赠',
};

const categoryOptions = [
  { id: 'cat-handbag', name: '手袋' },
  { id: 'cat-watch', name: '腕表' },
  { id: 'cat-jewelry', name: '珠宝' },
  { id: 'cat-apparel', name: '服饰' },
  { id: 'cat-shoes', name: '鞋履' },
];

const current = ref(0);
const draft = reactive<CampaignDraft>({
  name: '',
  type: 'fullReduction',
  dateRange: [],
  threshold: '',
  reduction: '',
  discountRate: '',
  giftThreshold: '',
  giftCount: '',
  scope: 'all',
  categoryIds: [],
  productKeyword: '',
  publishNote: '',
});

const ruleSummary = computed(() => {
  switch (draft.type) {
    case 'fullReduction':
      return draft.threshold && draft.reduction
        ? `满 ¥${draft.threshold} 减 ¥${draft.reduction}`
        : '待配置满减规则';
    case 'discount':
      return draft.discountRate ? `全场 ${draft.discountRate} 折` : '待配置折扣规则';
    case 'gift':
      return draft.giftThreshold && draft.giftCount
        ? `满 ${draft.giftThreshold} 件 赠 ${draft.giftCount} 件`
        : '待配置满赠规则';
  }
});

const dateLabel = computed(() =>
  draft.dateRange.length === 2
    ? `${draft.dateRange[0]} 至 ${draft.dateRange[1]}`
    : '未设置活动时间',
);

const scopeLabel = computed(() => {
  if (draft.scope === 'all') return '全部商品';
  if (draft.scope === 'category')
    return draft.categoryIds.length
      ? `${draft.categoryIds.length} 个分类`
      : '未选择分类';
  return draft.productKeyword || '未指定商品';
});

function validateStep(step: number): string | null {
  if (step === 0) {
    if (!draft.name.trim()) return '请输入活动名称';
    if (draft.dateRange.length !== 2) return '请选择活动时间范围';
  }
  if (step === 1) {
    if (draft.type === 'fullReduction' && (!draft.threshold || !draft.reduction))
      return '请完整配置满减门槛与优惠金额';
    if (draft.type === 'discount' && !draft.discountRate) return '请输入折扣力度';
    if (draft.type === 'gift' && (!draft.giftThreshold || !draft.giftCount))
      return '请完整配置满赠门槛与赠品数量';
  }
  if (step === 2 && draft.scope === 'category' && !draft.categoryIds.length)
    return '请至少选择一个商品分类';
  return null;
}

function handleNext(): void {
  const error = validateStep(current.value);
  if (error) {
    ElMessage.warning(error);
    return;
  }
  if (current.value < steps.length - 1) current.value++;
}

function handlePrev(): void {
  if (current.value > 0) current.value--;
}

function handleSaveDraft(): void {
  const error = validateStep(0);
  if (error) {
    ElMessage.warning(error);
    return;
  }
  ElMessage.success(`草稿「${draft.name}」已保存`);
}

function handlePublish(): void {
  for (let i = 0; i < steps.length - 1; i++) {
    const error = validateStep(i);
    if (error) {
      current.value = i;
      ElMessage.warning(error);
      return;
    }
  }
  ElMessage.success(`活动「${draft.name || '未命名活动'}」已发布，将于 ${dateLabel.value} 生效`);
}
</script>

<template>
  <section aria-labelledby="campaign-title" class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 id="campaign-title" class="text-xl font-medium text-[var(--pc-text-primary)]">创建营销活动</h1>
        <p class="mt-2 text-sm text-[var(--pc-text-secondary)]">按步骤配置优惠规则与适用范围，右侧实时预览活动效果。</p>
      </div>
    </div>

    <el-card shadow="never" body-style="padding: 24px;">
      <el-steps :active="current" align-center class="mb-8">
        <el-step v-for="step in steps" :key="step.title" :title="step.title" :description="step.description" />
      </el-steps>

      <el-row :gutter="24">
        <el-col :lg="16">
          <div v-show="current === 0" class="space-y-5">
            <h2 class="text-base font-medium text-[var(--pc-text-primary)]">基本信息</h2>
            <el-form label-position="right" label-width="100px">
              <el-form-item label="活动名称" required>
                <el-input
                  v-model="draft.name"
                  maxlength="40"
                  show-word-limit
                  placeholder="例如：金秋奢品满减季"
                />
              </el-form-item>
              <el-form-item label="活动类型" required>
                <el-radio-group v-model="draft.type">
                  <el-radio-button value="fullReduction">满减</el-radio-button>
                  <el-radio-button value="discount">折扣</el-radio-button>
                  <el-radio-button value="gift">满赠</el-radio-button>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="活动时间" required>
                <el-date-picker
                  v-model="draft.dateRange"
                  type="datetimerange"
                  range-separator="至"
                  start-placeholder="开始时间"
                  end-placeholder="结束时间"
                  format="YYYY-MM-DD HH:mm"
                  value-format="YYYY-MM-DD HH:mm"
                  class="w-full"
                />
              </el-form-item>
            </el-form>
          </div>

          <div v-show="current === 1" class="space-y-5">
            <h2 class="text-base font-medium text-[var(--pc-text-primary)]">优惠规则</h2>
            <el-form label-position="right" label-width="100px">
              <template v-if="draft.type === 'fullReduction'">
                <el-form-item label="满减门槛" required>
                  <el-input v-model="draft.threshold" prefix="¥" placeholder="如 10000" />
                </el-form-item>
                <el-form-item label="优惠金额" required>
                  <el-input v-model="draft.reduction" prefix="¥" placeholder="如 800" />
                </el-form-item>
              </template>
              <template v-else-if="draft.type === 'discount'">
                <el-form-item label="折扣力度" required>
                  <el-input v-model="draft.discountRate" suffix="折" placeholder="如 8.5" />
                  <p class="mt-1 text-xs text-[var(--pc-text-secondary)]">输入 8.5 表示 8.5 折。</p>
                </el-form-item>
              </template>
              <template v-else>
                <el-form-item label="满赠门槛" required>
                  <el-input v-model="draft.giftThreshold" suffix="件" placeholder="如 2" />
                </el-form-item>
                <el-form-item label="赠品数量" required>
                  <el-input v-model="draft.giftCount" suffix="件" placeholder="如 1" />
                </el-form-item>
              </template>
            </el-form>
          </div>

          <div v-show="current === 2" class="space-y-5">
            <h2 class="text-base font-medium text-[var(--pc-text-primary)]">适用商品</h2>
            <el-form label-position="right" label-width="100px">
              <el-form-item label="参与范围" required>
                <el-radio-group v-model="draft.scope">
                  <el-radio value="all">全部商品</el-radio>
                  <el-radio value="category">指定分类</el-radio>
                  <el-radio value="product">指定商品</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item v-if="draft.scope === 'category'" label="商品分类">
                <el-checkbox-group v-model="draft.categoryIds">
                  <el-checkbox
                    v-for="option in categoryOptions"
                    :key="option.id"
                    :value="option.id"
                    :label="option.name"
                  />
                </el-checkbox-group>
              </el-form-item>
              <el-form-item v-else-if="draft.scope === 'product'" label="商品关键词">
                <el-input
                  v-model="draft.productKeyword"
                  placeholder="输入商品名称或 SKU，后续可从商品选择器精确指定"
                />
              </el-form-item>
            </el-form>
          </div>

          <div v-show="current === 3" class="space-y-5">
            <h2 class="text-base font-medium text-[var(--pc-text-primary)]">发布设置</h2>
            <el-form label-position="right" label-width="100px">
            <el-form-item label="上线方式">
              <span class="text-sm text-[var(--pc-text-primary)]">活动时间到达后自动上线</span>
              <p class="mt-1 text-xs text-[var(--pc-text-secondary)]">
                发布后将在设定的开始时间自动生效。
              </p>
            </el-form-item>
              <el-form-item label="活动说明">
                <el-input
                  v-model="draft.publishNote"
                  type="textarea"
                  :rows="4"
                  maxlength="200"
                  show-word-limit
                  placeholder="面向消费者的活动说明，将展示在活动详情页"
                />
              </el-form-item>
            </el-form>
          </div>
        </el-col>

        <el-col :lg="8">
          <div class="rounded border border-[var(--pc-border)] bg-[var(--pc-bg-page)] p-5">
            <p class="mb-4 text-xs font-medium text-[var(--pc-text-muted)]">实时预览</p>
            <div class="rounded bg-[var(--pc-bg-surface)] p-5 shadow-[var(--pc-shadow-card)]">
              <div class="mb-3 flex items-center gap-2">
                <el-tag type="danger" size="small" effect="dark">{{ typeLabels[draft.type] }}</el-tag>
                <p class="truncate text-base font-semibold text-[var(--pc-text-primary)]">
                  {{ draft.name || '未命名活动' }}
                </p>
              </div>
              <p class="mb-4 text-sm font-medium text-[var(--pc-danger)]">{{ ruleSummary }}</p>
              <div class="space-y-2 text-xs text-[var(--pc-text-secondary)]">
                <p><span class="text-[var(--pc-text-muted)]">活动时间</span> · {{ dateLabel }}</p>
                <p><span class="text-[var(--pc-text-muted)]">参与范围</span> · {{ scopeLabel }}</p>
                <p v-if="draft.publishNote" class="leading-5">{{ draft.publishNote }}</p>
              </div>
            </div>
            <p class="mt-4 text-xs text-[var(--pc-text-muted)]">
              预览仅展示活动卡片外观，最终效果以消费者端为准。
            </p>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <div class="flex items-center justify-between rounded border border-[var(--pc-border)] bg-[var(--pc-bg-surface)] px-5 py-3">
      <el-button :disabled="current === 0" @click="handlePrev">上一步</el-button>
      <div class="flex gap-2">
        <el-button @click="handleSaveDraft">保存草稿</el-button>
        <el-button v-if="current < steps.length - 1" type="primary" @click="handleNext">下一步</el-button>
        <el-button v-else type="primary" @click="handlePublish">发布活动</el-button>
      </div>
    </div>
  </section>
</template>
