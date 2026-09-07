<script setup lang="ts">
/** 数据概览：核心指标、销售趋势、热销与新增会员排行。 */
import { computed, ref } from 'vue';

interface MetricCard {
  key: string;
  label: string;
  value: string;
  trend: number;
  trendLabel: string;
}

interface RankItem {
  rank: number;
  name: string;
  detail: string;
  amount: string;
}

interface MemberRankItem {
  rank: number;
  nickname: string;
  registeredAt: string;
  level: string;
  levelType: 'success' | 'warning' | 'info';
}

const metrics: MetricCard[] = [
  { key: 'sales', label: '今日销售额', value: '¥ 48,920', trend: 12.5, trendLabel: '较昨日' },
  { key: 'orders', label: '今日订单', value: '156', trend: 8.3, trendLabel: '较昨日' },
  { key: 'visitors', label: '今日访客', value: '1,247', trend: -3.2, trendLabel: '较昨日' },
  { key: 'conversion', label: '转化率', value: '1.28%', trend: 0.15, trendLabel: '较昨日' },
];

const ranges = [
  { key: '7d', label: '近 7 天' },
  { key: '30d', label: '近 30 天' },
  { key: '90d', label: '近 90 天' },
] as const;
type RangeKey = (typeof ranges)[number]['key'];
const activeRange = ref<RangeKey>('30d');

const salesData: Record<RangeKey, number[]> = {
  '7d': [18600, 22400, 19800, 26500, 31200, 28900, 48920],
  '30d': [
    21500, 19800, 23400, 26800, 24100, 28900, 31200, 27600, 25400, 29800,
    32600, 30100, 27800, 34500, 36800, 34100, 38900, 41200, 38600, 42500,
    40800, 39200, 45600, 47800, 44100, 42800, 46900, 51200, 48900, 48920,
  ],
  '90d': [
    18600, 21300, 24500, 26800, 29400, 32100, 28900, 34200, 37800, 41200,
    38900, 48920,
  ],
};
const salesLabels: Record<RangeKey, string[]> = {
  '7d': ['08-27', '08-28', '08-29', '08-30', '08-31', '09-01', '09-02'],
  '30d': Array.from({ length: 30 }, (_, i) => (i % 5 === 0 ? `08-${String(i + 4).padStart(2, '0')}` : '')),
  '90d': ['7月', '', '8月', '', '', '', '9月', '', '', '', '', '今日'],
};

const chartWidth = 700;
const chartHeight = 280;
const padLeft = 56;
const padRight = 24;
const padTop = 24;
const padBottom = 40;
const chartW = chartWidth - padLeft - padRight;
const chartH = chartHeight - padTop - padBottom;

const hoverIndex = ref<number | null>(null);

interface ChartPoint {
  x: number;
  y: number;
  value: number;
}

const chartPoints = computed<ChartPoint[]>(() => {
  const values = salesData[activeRange.value];
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  return values.map((value, i) => ({
    value,
    x: padLeft + (i / (values.length - 1)) * chartW,
    y: padTop + (1 - (value - min) / span) * chartH,
  }));
});

const linePath = computed(() =>
  chartPoints.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
);

const areaPath = computed(() => {
  const pts = chartPoints.value;
  if (pts.length < 2) return '';
  const last = pts[pts.length - 1];
  const first = pts[0];
  if (!last || !first) return '';
  const baseY = padTop + chartH;
  return `${linePath.value} L${last.x.toFixed(1)},${baseY} L${first.x.toFixed(1)},${baseY} Z`;
});

const hoverPoint = computed<ChartPoint | null>(() => {
  const idx = hoverIndex.value;
  if (idx === null) return null;
  return chartPoints.value[idx] ?? null;
});

const yTicks = computed(() => {
  const values = salesData[activeRange.value];
  const max = Math.max(...values);
  const min = Math.min(...values);
  const step = (max - min) / 4 || 1;
  return Array.from({ length: 5 }, (_, i) => {
    const value = min + step * i;
    const y = padTop + (1 - i / 4) * chartH;
    return { value: Math.round(value), y };
  });
});

const labels = computed(() => salesLabels[activeRange.value]);

function formatAxis(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return String(value);
}

function handleChartMove(event: MouseEvent): void {
  const target = event.currentTarget as SVGElement;
  const rect = target.getBoundingClientRect();
  const ratio = (event.clientX - rect.left) / rect.width;
  const n = chartPoints.value.length;
  hoverIndex.value = Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1))));
}

function clearHover(): void {
  hoverIndex.value = null;
}

const hotProducts: RankItem[] = [
  { rank: 1, name: 'Hermès Birkin 25 鞋扣款', detail: '已售 3 件 · 32 收藏', amount: '¥ 315,000' },
  { rank: 2, name: 'Rolex 日志型 36 蓝罗', detail: '已售 5 件 · 21 收藏', amount: '¥ 245,000' },
  { rank: 3, name: 'Chanel CF 中号 黑金', detail: '已售 7 件 · 54 收藏', amount: '¥ 168,000' },
  { rank: 4, name: 'Louis Vuitton Neverfull MM', detail: '已售 32 件 · 88 收藏', amount: '¥ 186,000' },
  { rank: 5, name: 'Cartier LOVE 手镯 18K', detail: '已售 18 件 · 42 收藏', amount: '¥ 126,000' },
];

const newMembers: MemberRankItem[] = [
  { rank: 1, nickname: '林若曦', registeredAt: '14:32', level: 'VIP', levelType: 'success' },
  { rank: 2, nickname: '陈墨白', registeredAt: '13:18', level: '普通', levelType: 'info' },
  { rank: 3, nickname: '苏晚晴', registeredAt: '12:46', level: '银卡', levelType: 'warning' },
  { rank: 4, nickname: '周予安', registeredAt: '11:09', level: '普通', levelType: 'info' },
  { rank: 5, nickname: '叶南珩', registeredAt: '10:22', level: '金卡', levelType: 'success' },
];
</script>

<template>
  <section aria-labelledby="dashboard-title" class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 id="dashboard-title" class="text-xl font-medium text-[var(--pc-text-primary)]">经营概览</h1>
        <p class="mt-2 text-sm text-[var(--pc-text-secondary)]">实时掌握店铺经营核心指标与趋势走向。</p>
      </div>
      <div class="flex items-center gap-2 text-sm text-[var(--pc-text-secondary)]">
        <span>数据更新于</span>
        <span class="font-medium text-[var(--pc-text-regular)]">2026-09-02 16:00</span>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <el-card v-for="metric in metrics" :key="metric.key" shadow="never" body-style="padding: 20px;">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm text-[var(--pc-text-secondary)]">{{ metric.label }}</p>
            <p class="mt-3 text-2xl font-semibold text-[var(--pc-text-primary)]">{{ metric.value }}</p>
          </div>
          <span
            class="flex h-10 w-10 flex-none items-center justify-center rounded bg-[var(--pc-primary-soft)] text-sm font-semibold text-[var(--pc-primary)]"
            >{{ metric.label.slice(0, 1) }}</span
          >
        </div>
        <div class="mt-4 flex items-center gap-2 text-xs">
          <span :class="metric.trend >= 0 ? 'text-[var(--pc-success)]' : 'text-[var(--pc-danger)]'">
            <span class="font-medium">{{ metric.trend >= 0 ? '▲' : '▼' }}</span>
            {{ Math.abs(metric.trend) }}%
          </span>
          <span class="text-[var(--pc-text-muted)]">{{ metric.trendLabel }}</span>
        </div>
      </el-card>
    </div>

    <el-card shadow="never" body-style="padding: 20px 20px 8px;">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h2 class="text-base font-medium text-[var(--pc-text-primary)]">销售额趋势</h2>
          <p class="mt-1 text-xs text-[var(--pc-text-secondary)]">按日统计已支付订单实付金额。</p>
        </div>
        <div class="flex gap-1 rounded border border-[var(--pc-border)] p-0.5">
          <button
            v-for="range in ranges"
            :key="range.key"
            type="button"
            class="whitespace-nowrap rounded px-3 py-1 text-xs transition"
            :class="
              activeRange === range.key
                ? 'bg-[var(--pc-primary)] text-white'
                : 'text-[var(--pc-text-regular)] hover:text-[var(--pc-primary)]'
            "
            @click="activeRange = range.key"
            >{{ range.label }}</button
          >
        </div>
      </div>
      <svg
        :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
        width="100%"
        height="300"
        preserveAspectRatio="xMidYMid meet"
        class="block"
        @mousemove="handleChartMove"
        @mouseleave="clearHover"
      >
        <defs>
          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--pc-primary)" stop-opacity="0.22" />
            <stop offset="100%" stop-color="var(--pc-primary)" stop-opacity="0" />
          </linearGradient>
        </defs>

        <g>
          <line
            v-for="tick in yTicks"
            :key="`grid-${tick.value}`"
            :x1="padLeft"
            :x2="chartWidth - padRight"
            :y1="tick.y"
            :y2="tick.y"
            stroke="var(--pc-border)"
            stroke-dasharray="3 4"
          />
          <text
            v-for="tick in yTicks"
            :key="`ylabel-${tick.value}`"
            :x="padLeft - 12"
            :y="tick.y + 4"
            text-anchor="end"
            fill="var(--pc-text-muted)"
            font-size="11"
            >{{ formatAxis(tick.value) }}</text
          >
        </g>

        <path :d="areaPath" fill="url(#salesGradient)" />
        <path :d="linePath" fill="none" stroke="var(--pc-primary)" stroke-width="2" stroke-linejoin="round" />

        <text
          v-for="(label, i) in labels"
          :key="`xlabel-${i}`"
          :x="padLeft + (i / (labels.length - 1)) * chartW"
          :y="chartHeight - 14"
          text-anchor="middle"
          fill="var(--pc-text-muted)"
          font-size="11"
          >{{ label }}</text
        >

        <g v-if="hoverPoint">
          <line
            :x1="hoverPoint.x"
            :x2="hoverPoint.x"
            :y1="padTop"
            :y2="padTop + chartH"
            stroke="var(--pc-primary)"
            stroke-opacity="0.4"
            stroke-dasharray="4 3"
          />
          <circle
            :cx="hoverPoint.x"
            :cy="hoverPoint.y"
            r="6"
            fill="var(--pc-primary)"
            stroke="#fff"
            stroke-width="2"
          />
          <g :transform="`translate(${Math.min(hoverPoint.x, chartWidth - 132)}, ${Math.max(hoverPoint.y - 64, padTop)})`">
            <rect width="120" height="44" rx="6" fill="#1d2129" />
            <text x="12" y="18" fill="#e5e6eb" font-size="11">{{ labels[hoverIndex ?? 0] || '当日' }}</text>
            <text x="12" y="35" fill="#fff" font-size="13" font-weight="600">¥ {{ hoverPoint.value.toLocaleString() }}</text>
          </g>
        </g>
      </svg>
    </el-card>

    <div class="grid gap-4 lg:grid-cols-2">
      <el-card shadow="never" body-style="padding: 20px;">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-base font-medium text-[var(--pc-text-primary)]">热销商品排行</h2>
          <el-button link type="primary" class="whitespace-nowrap">查看全部</el-button>
        </div>
        <ul class="space-y-3">
          <li
            v-for="item in hotProducts"
            :key="item.rank"
            class="flex items-center gap-3 rounded border border-[var(--pc-border)] px-3 py-2.5"
          >
            <span
              class="flex h-7 w-7 flex-none items-center justify-center rounded text-xs font-semibold"
              :class="
                item.rank <= 3
                  ? 'bg-[var(--pc-primary)] text-white'
                  : 'bg-[var(--pc-bg-page)] text-[var(--pc-text-secondary)]'
              "
              >{{ item.rank }}</span
            >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-[var(--pc-text-primary)]">{{ item.name }}</p>
              <p class="mt-0.5 text-xs text-[var(--pc-text-secondary)]">{{ item.detail }}</p>
            </div>
            <span class="whitespace-nowrap font-mono text-sm font-semibold text-[var(--pc-primary)]">{{
              item.amount
            }}</span>
          </li>
        </ul>
      </el-card>

      <el-card shadow="never" body-style="padding: 20px;">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-base font-medium text-[var(--pc-text-primary)]">新增会员排行</h2>
          <el-button link type="primary" class="whitespace-nowrap">查看全部</el-button>
        </div>
        <ul class="space-y-3">
          <li
            v-for="item in newMembers"
            :key="item.rank"
            class="flex items-center gap-3 rounded border border-[var(--pc-border)] px-3 py-2.5"
          >
            <span
              class="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--pc-primary-soft)] text-xs font-medium text-[var(--pc-primary)]"
              >{{ item.nickname.slice(0, 1) }}</span
            >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-[var(--pc-text-primary)]">{{ item.nickname }}</p>
              <p class="mt-0.5 text-xs text-[var(--pc-text-secondary)]">今日 {{ item.registeredAt }} 注册</p>
            </div>
            <el-tag class="whitespace-nowrap" :type="item.levelType" size="small">{{ item.level }}</el-tag>
          </li>
        </ul>
      </el-card>
    </div>
  </section>
</template>
