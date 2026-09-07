<script setup lang="ts">
/** 会员管理：检索、等级、消费概览与冻结操作。 */
import { computed, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

type MemberLevel = 'normal' | 'silver' | 'gold' | 'vip';
type MemberStatus = 'active' | 'frozen';

interface Member {
  id: string;
  nickname: string;
  phone: string;
  level: MemberLevel;
  totalSpent: string;
  orderCount: number;
  registeredAt: string;
  lastActiveAt: string;
  status: MemberStatus;
  tags: string[];
}

const levelLabels: Record<MemberLevel, string> = {
  normal: '普通',
  silver: '银卡',
  gold: '金卡',
  vip: 'VIP',
};
const levelTypes: Record<MemberLevel, 'info' | 'warning' | 'success' | 'danger'> = {
  normal: 'info',
  silver: 'info',
  gold: 'warning',
  vip: 'danger',
};

const members = ref<Member[]>([
  { id: 'M20260902-01', nickname: '林若曦', phone: '138****8821', level: 'vip', totalSpent: '326500', orderCount: 14, registeredAt: '2025-11-03 10:22', lastActiveAt: '2026-09-02 14:32', status: 'active', tags: ['高净值', '复购'] },
  { id: 'M20260902-02', nickname: '陈墨白', phone: '139****0147', level: 'normal', totalSpent: '4800', orderCount: 1, registeredAt: '2026-09-02 13:18', lastActiveAt: '2026-09-02 15:40', status: 'active', tags: ['新客'] },
  { id: 'M20260831-09', nickname: '苏晚晴', phone: '137****6638', level: 'silver', totalSpent: '58200', orderCount: 6, registeredAt: '2026-03-18 09:41', lastActiveAt: '2026-09-01 21:15', status: 'active', tags: ['腕表偏好'] },
  { id: 'M20260828-15', nickname: '周予安', phone: '135****9920', level: 'normal', totalSpent: '12600', orderCount: 2, registeredAt: '2026-08-28 16:03', lastActiveAt: '2026-09-02 11:09', status: 'active', tags: ['新客'] },
  { id: 'M20260712-03', nickname: '叶南珩', phone: '136****4471', level: 'gold', totalSpent: '184000', orderCount: 9, registeredAt: '2025-07-12 14:25', lastActiveAt: '2026-09-02 10:22', status: 'active', tags: ['手袋偏好', '复购'] },
  { id: 'M20260605-22', nickname: '沈知夏', phone: '133****0098', level: 'silver', totalSpent: '76400', orderCount: 7, registeredAt: '2026-01-05 19:33', lastActiveAt: '2026-08-30 22:08', status: 'active', tags: ['珠宝偏好'] },
  { id: 'M20260518-07', nickname: '江星辞', phone: '188****2231', level: 'vip', totalSpent: '412000', orderCount: 18, registeredAt: '2024-12-18 11:50', lastActiveAt: '2026-09-01 20:41', status: 'active', tags: ['高净值', '鉴定复购'] },
  { id: 'M20260409-14', nickname: '温景行', phone: '189****6677', level: 'gold', totalSpent: '158000', orderCount: 11, registeredAt: '2025-09-09 08:17', lastActiveAt: '2026-08-29 17:26', status: 'active', tags: ['服饰偏好'] },
  { id: 'M20260322-31', nickname: '楚怀瑾', phone: '131****0045', level: 'normal', totalSpent: '3200', orderCount: 1, registeredAt: '2026-03-22 13:09', lastActiveAt: '2026-08-15 10:00', status: 'active', tags: ['流失风险'] },
  { id: 'M20260218-19', nickname: '宋清欢', phone: '132****8890', level: 'silver', totalSpent: '64800', orderCount: 5, registeredAt: '2026-02-18 15:44', lastActiveAt: '2026-09-02 09:18', status: 'frozen', tags: ['异常账户'] },
  { id: 'M20260130-26', nickname: '韩临渊', phone: '130****5512', level: 'gold', totalSpent: '192000', orderCount: 13, registeredAt: '2025-06-30 10:11', lastActiveAt: '2026-09-02 13:55', status: 'active', tags: ['腕表偏好', '高净值'] },
  { id: 'M20260112-08', nickname: '顾长卿', phone: '188****3300', level: 'vip', totalSpent: '286000', orderCount: 16, registeredAt: '2025-04-12 16:28', lastActiveAt: '2026-09-02 12:30', status: 'active', tags: ['复购', '推荐'] },
  { id: 'M20251225-11', nickname: '白疏影', phone: '139****1278', level: 'normal', totalSpent: '9800', orderCount: 2, registeredAt: '2025-12-25 20:15', lastActiveAt: '2026-08-20 19:00', status: 'active', tags: ['鞋履偏好'] },
  { id: 'M20251108-04', nickname: '裴砚之', phone: '137****4456', level: 'gold', totalSpent: '168000', orderCount: 10, registeredAt: '2025-11-08 09:30', lastActiveAt: '2026-09-01 18:22', status: 'active', tags: ['手袋偏好'] },
  { id: 'M20251001-29', nickname: '谢明轩', phone: '135****7788', level: 'silver', totalSpent: '52100', orderCount: 6, registeredAt: '2025-10-01 14:00', lastActiveAt: '2026-08-28 11:45', status: 'active', tags: ['珠宝偏好', '复购'] },
]);

const filters = reactive<{ keyword: string; level: '' | MemberLevel; status: '' | MemberStatus }>({
  keyword: '',
  level: '',
  status: '',
});
const page = ref(1);
const pageSize = ref(10);
const detailVisible = ref(false);
const selectedMember = ref<Member | null>(null);

const filtered = computed(() =>
  members.value.filter((item) => {
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      if (!item.nickname.toLowerCase().includes(kw) && !item.phone.includes(filters.keyword)) return false;
    }
    if (filters.level && item.level !== filters.level) return false;
    if (filters.status && item.status !== filters.status) return false;
    return true;
  }),
);

const total = computed(() => filtered.value.length);
const paged = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filtered.value.slice(start, start + pageSize.value);
});

const summary = computed(() => {
  const active = members.value.filter((m) => m.status === 'active').length;
  const vip = members.value.filter((m) => m.level === 'vip').length;
  const totalSpent = members.value.reduce((sum, m) => sum + Number(m.totalSpent), 0);
  return { total: members.value.length, active, vip, totalSpent: totalSpent.toLocaleString() };
});

function handleSearch(): void {
  page.value = 1;
}

function handleReset(): void {
  filters.keyword = '';
  filters.level = '';
  filters.status = '';
  page.value = 1;
}

function levelTagType(level: MemberLevel): 'info' | 'warning' | 'success' | 'danger' {
  return levelTypes[level];
}

function levelText(level: MemberLevel): string {
  return levelLabels[level];
}

function openDetail(member: Member): void {
  selectedMember.value = member;
  detailVisible.value = true;
}

async function toggleStatus(member: Member): Promise<void> {
  const action = member.status === 'active' ? '冻结' : '解冻';
  await ElMessageBox.confirm(`确认${action}会员「${member.nickname}」？`, `${action}会员`, {
    type: 'warning',
  });
  member.status = member.status === 'active' ? 'frozen' : 'active';
  ElMessage.success(`已${action}该会员`);
}
</script>

<template>
  <section aria-labelledby="members-title" class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 id="members-title" class="text-xl font-medium text-[var(--pc-text-primary)]">会员管理</h1>
        <p class="mt-2 text-sm text-[var(--pc-text-secondary)]">维护会员档案、等级与账户状态。</p>
      </div>
      <div class="flex gap-4 text-sm">
        <div class="text-center">
          <p class="text-lg font-semibold text-[var(--pc-text-primary)]">{{ summary.total }}</p>
          <p class="text-xs text-[var(--pc-text-secondary)]">总会员</p>
        </div>
        <div class="text-center">
          <p class="text-lg font-semibold text-[var(--pc-success)]">{{ summary.active }}</p>
          <p class="text-xs text-[var(--pc-text-secondary)]">活跃</p>
        </div>
        <div class="text-center">
          <p class="text-lg font-semibold text-[var(--pc-danger)]">{{ summary.vip }}</p>
          <p class="text-xs text-[var(--pc-text-secondary)]">VIP</p>
        </div>
        <div class="text-center">
          <p class="text-lg font-semibold text-[var(--pc-primary)]">¥ {{ summary.totalSpent }}</p>
          <p class="text-xs text-[var(--pc-text-secondary)]">累计消费</p>
        </div>
      </div>
    </div>

    <el-card shadow="never">
      <div class="flex flex-wrap items-center gap-3">
        <el-input
          v-model="filters.keyword"
          class="w-64"
          clearable
          placeholder="搜索昵称或手机号"
          @keyup.enter="handleSearch"
        />
        <el-select v-model="filters.level" class="w-32" clearable placeholder="全部等级" @change="handleSearch">
          <el-option label="普通" value="normal" />
          <el-option label="银卡" value="silver" />
          <el-option label="金卡" value="gold" />
          <el-option label="VIP" value="vip" />
        </el-select>
        <el-select v-model="filters.status" class="w-32" clearable placeholder="全部状态" @change="handleSearch">
          <el-option label="正常" value="active" />
          <el-option label="冻结" value="frozen" />
        </el-select>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table :data="paged" empty-text="暂无符合条件的会员">
        <el-table-column label="会员" min-width="220">
          <template #default="{ row }">
            <div class="flex items-center gap-3">
              <span class="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--pc-primary-soft)] text-xs font-medium text-[var(--pc-primary)]">{{
                row.nickname.slice(0, 1)
              }}</span>
              <div>
                <p class="font-medium text-[var(--pc-text-primary)]">{{ row.nickname }}</p>
                <p class="mt-0.5 text-xs text-[var(--pc-text-secondary)]">{{ row.phone }}</p>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="等级" width="100">
          <template #default="{ row }">
            <el-tag class="whitespace-nowrap" :type="levelTagType(row.level)" size="small">{{
              levelText(row.level)
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="累计消费" width="150">
          <template #default="{ row }"
            ><span class="font-mono text-[var(--pc-primary)]">¥ {{ row.totalSpent }}</span></template
          >
        </el-table-column>
        <el-table-column prop="orderCount" label="订单数" width="90" />
        <el-table-column label="标签" min-width="180">
          <template #default="{ row }">
            <el-tag
              v-for="tag in row.tags"
              :key="tag"
              class="mr-1 whitespace-nowrap"
              size="small"
              type="info"
              >{{ tag }}</el-tag
            >
          </template>
        </el-table-column>
        <el-table-column label="注册时间" min-width="170">
          <template #default="{ row }">{{ row.registeredAt }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag class="whitespace-nowrap" :type="row.status === 'active' ? 'success' : 'danger'" size="small">{{
              row.status === 'active' ? '正常' : '冻结'
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
            <el-button
              link
              :type="row.status === 'active' ? 'danger' : 'primary'"
              @click="toggleStatus(row)"
              >{{ row.status === 'active' ? '冻结' : '解冻' }}</el-button
            >
          </template>
        </el-table-column>
      </el-table>
      <div class="mt-4 flex justify-end">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
        />
      </div>
    </el-card>

    <el-drawer v-model="detailVisible" title="会员详情" size="480px">
      <template v-if="selectedMember">
        <div class="mb-6 flex items-center gap-4">
          <span class="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--pc-primary-soft)] text-lg font-medium text-[var(--pc-primary)]">{{
            selectedMember.nickname.slice(0, 1)
          }}</span>
          <div>
            <p class="text-lg font-semibold text-[var(--pc-text-primary)]">{{ selectedMember.nickname }}</p>
            <p class="mt-1 text-sm text-[var(--pc-text-secondary)]">{{ selectedMember.phone }}</p>
          </div>
          <el-tag class="ml-auto whitespace-nowrap" :type="levelTypes[selectedMember.level]" size="small">{{
            levelLabels[selectedMember.level]
          }}</el-tag>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="rounded border border-[var(--pc-border)] p-4">
            <p class="text-xs text-[var(--pc-text-secondary)]">累计消费</p>
            <p class="mt-1 font-mono text-lg font-semibold text-[var(--pc-primary)]">¥ {{ selectedMember.totalSpent }}</p>
          </div>
          <div class="rounded border border-[var(--pc-border)] p-4">
            <p class="text-xs text-[var(--pc-text-secondary)]">订单数</p>
            <p class="mt-1 text-lg font-semibold text-[var(--pc-text-primary)]">{{ selectedMember.orderCount }}</p>
          </div>
          <div class="rounded border border-[var(--pc-border)] p-4">
            <p class="text-xs text-[var(--pc-text-secondary)]">注册时间</p>
            <p class="mt-1 text-sm text-[var(--pc-text-primary)]">{{ selectedMember.registeredAt }}</p>
          </div>
          <div class="rounded border border-[var(--pc-border)] p-4">
            <p class="text-xs text-[var(--pc-text-secondary)]">最近活跃</p>
            <p class="mt-1 text-sm text-[var(--pc-text-primary)]">{{ selectedMember.lastActiveAt }}</p>
          </div>
        </div>
        <div class="mt-6">
          <p class="mb-2 text-sm text-[var(--pc-text-secondary)]">会员标签</p>
          <el-tag
            v-for="tag in selectedMember.tags"
            :key="tag"
            class="mr-2 whitespace-nowrap"
            type="info"
            >{{ tag }}</el-tag
          >
        </div>
        <div class="mt-6">
          <p class="mb-2 text-sm text-[var(--pc-text-secondary)]">账户状态</p>
          <el-tag :type="selectedMember.status === 'active' ? 'success' : 'danger'">{{
            selectedMember.status === 'active' ? '正常' : '已冻结'
          }}</el-tag>
        </div>
      </template>
    </el-drawer>
  </section>
</template>
