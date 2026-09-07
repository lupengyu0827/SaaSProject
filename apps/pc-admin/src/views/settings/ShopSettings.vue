<script setup lang="ts">
/** 店铺设置：基本信息、营业策略与品牌资料。 */
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';

interface ShopSettings {
  shopName: string;
  intro: string;
  serviceWechat: string;
  businessHours: string;
  logoUrl: string;
  businessStatus: 'open' | 'closed';
  autoAcceptOrder: boolean;
  stockWarningThreshold: number;
  privateDealGuide: boolean;
  brandStory: string;
  mainCategories: string[];
  brandLogoUrl: string;
}

const categoryOptions = [
  { id: 'cat-handbag', name: '手袋' },
  { id: 'cat-watch', name: '腕表' },
  { id: 'cat-jewelry', name: '珠宝' },
  { id: 'cat-apparel', name: '服饰' },
  { id: 'cat-shoes', name: '鞋履' },
  { id: 'cat-accessory', name: '配饰' },
];

const activeTab = ref('basic');
const submitting = ref(false);
const settings = reactive<ShopSettings>({
  shopName: '臻品奢物 · 旗舰店',
  intro: '专注二手奢侈品鉴定寄售，提供专业鉴定与可溯源服务。',
  serviceWechat: 'zhenpin-service',
  businessHours: '周一至周日 10:00 - 22:00',
  logoUrl: '',
  businessStatus: 'open',
  autoAcceptOrder: true,
  stockWarningThreshold: 3,
  privateDealGuide: true,
  brandStory:
    '臻品奢物成立于 2024 年，致力于为二手奢侈品爱好者提供专业、透明、可溯源的鉴定寄售服务。所有商品均经资深鉴定师双重把关，附带鉴定证书。',
  mainCategories: ['cat-handbag', 'cat-watch', 'cat-jewelry'],
  brandLogoUrl: '',
});

function handleSave(): void {
  if (!settings.shopName.trim()) {
    ElMessage.warning('请输入店铺名称');
    activeTab.value = 'basic';
    return;
  }
  submitting.value = true;
  setTimeout(() => {
    submitting.value = false;
    ElMessage.success('店铺设置已保存');
  }, 600);
}

function handleReset(): void {
  ElMessage.info('已还原为最近一次保存的设置');
}
</script>

<template>
  <section aria-labelledby="settings-title" class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 id="settings-title" class="text-xl font-medium text-[var(--pc-text-primary)]">店铺设置</h1>
        <p class="mt-2 text-sm text-[var(--pc-text-secondary)]">维护店铺基本信息、营业策略与品牌资料。</p>
      </div>
      <div class="flex gap-2">
        <el-button @click="handleReset">还原</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSave">保存设置</el-button>
      </div>
    </div>

    <el-card shadow="never">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="基本信息" name="basic">
          <el-form label-position="right" label-width="120px" class="max-w-2xl">
            <el-form-item label="店铺名称" required>
              <el-input v-model="settings.shopName" maxlength="40" show-word-limit />
            </el-form-item>
            <el-form-item label="店铺简介">
              <el-input
                v-model="settings.intro"
                type="textarea"
                :rows="3"
                maxlength="200"
                show-word-limit
              />
            </el-form-item>
            <el-form-item label="客服微信">
              <el-input v-model="settings.serviceWechat" placeholder="用于私域成交引导展示" />
            </el-form-item>
            <el-form-item label="营业时间">
              <el-input v-model="settings.businessHours" placeholder="如：周一至周日 10:00 - 22:00" />
            </el-form-item>
            <el-form-item label="店铺 Logo">
              <el-input v-model="settings.logoUrl" placeholder="粘贴 Logo 图片地址" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="营业设置" name="business">
          <el-form label-position="right" label-width="140px" class="max-w-2xl">
            <el-form-item label="营业状态">
              <el-radio-group v-model="settings.businessStatus">
                <el-radio-button value="open">营业中</el-radio-button>
                <el-radio-button value="closed">休息中</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="自动接单">
              <el-switch v-model="settings.autoAcceptOrder" />
              <span class="ml-3 text-xs text-[var(--pc-text-secondary)]"
                >开启后新订单将自动进入待发货队列。</span
              >
            </el-form-item>
            <el-form-item label="库存预警阈值">
              <el-input-number v-model="settings.stockWarningThreshold" :min="0" :max="999" controls-position="right" />
              <span class="ml-3 text-xs text-[var(--pc-text-secondary)]"
                >可用库存低于该值时在商品列表标红预警。</span
              >
            </el-form-item>
            <el-form-item label="私域成交引导">
              <el-switch v-model="settings.privateDealGuide" />
              <span class="ml-3 text-xs text-[var(--pc-text-secondary)]"
                >开启后购买意向将展示店铺客服微信，引导线下成交。</span
              >
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="品牌介绍" name="brand">
          <el-form label-position="right" label-width="120px" class="max-w-2xl">
            <el-form-item label="品牌故事">
              <el-input
                v-model="settings.brandStory"
                type="textarea"
                :rows="6"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>
            <el-form-item label="主营类目">
              <el-checkbox-group v-model="settings.mainCategories">
                <el-checkbox
                  v-for="option in categoryOptions"
                  :key="option.id"
                  :value="option.id"
                  :label="option.name"
                />
              </el-checkbox-group>
            </el-form-item>
            <el-form-item label="品牌 LOGO">
              <el-input v-model="settings.brandLogoUrl" placeholder="粘贴品牌 Logo 图片地址" />
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <div class="flex justify-end gap-2 rounded border border-[var(--pc-border)] bg-[var(--pc-bg-surface)] px-5 py-3">
      <el-button @click="handleReset">还原</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSave">保存设置</el-button>
    </div>
  </section>
</template>
