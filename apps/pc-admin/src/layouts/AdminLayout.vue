<script setup lang="ts">
/** PC 商家后台标准布局：深色侧栏、56px 顶栏和轻量商务内容区。 */
import { ElMessage } from 'element-plus';
import { computed, defineComponent, h, ref } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';

import { useAuth } from '../composables/use-auth';
import { useAuthStore } from '../stores/use-auth-store';

const svgAttrs = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.6,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
} as const;

const MenuIcon = defineComponent({
  name: 'MenuIcon',
  props: { name: { type: String, required: true } },
  setup(props) {
    return () => {
      switch (props.name) {
        case 'dashboard':
          return h('svg', svgAttrs, [
            h('rect', { x: 3, y: 3, width: 8, height: 8, rx: 1.5 }),
            h('rect', { x: 13, y: 3, width: 8, height: 5, rx: 1.5 }),
            h('rect', { x: 13, y: 10, width: 8, height: 11, rx: 1.5 }),
            h('rect', { x: 3, y: 13, width: 8, height: 8, rx: 1.5 }),
          ]);
        case 'box':
          return h('svg', svgAttrs, [
            h('path', { d: 'M3 7l9-4 9 4v10l-9 4-9-4z' }),
            h('path', { d: 'M3 7l9 4 9-4' }),
            h('path', { d: 'M12 11v10' }),
          ]);
        case 'truck':
          return h('svg', svgAttrs, [
            h('rect', { x: 2, y: 6, width: 13, height: 10, rx: 1 }),
            h('path', { d: 'M15 9h4l3 3v4h-7z' }),
            h('circle', { cx: 6, cy: 19, r: 1.8 }),
            h('circle', { cx: 18, cy: 19, r: 1.8 }),
          ]);
        case 'user':
          return h('svg', svgAttrs, [
            h('circle', { cx: 12, cy: 8, r: 4 }),
            h('path', { d: 'M4 21c0-4 4-7 8-7s8 3 8 7' }),
          ]);
        case 'tag':
          return h('svg', svgAttrs, [
            h('path', { d: 'M3 7l5-4h6l7 7-6 6z' }),
            h('circle', { cx: 9, cy: 9, r: 1.5 }),
          ]);
        case 'settings':
          return h('svg', svgAttrs, [
            h('line', { x1: 4, y1: 7, x2: 20, y2: 7 }),
            h('line', { x1: 4, y1: 12, x2: 20, y2: 12 }),
            h('line', { x1: 4, y1: 17, x2: 20, y2: 17 }),
            h('circle', { cx: 9, cy: 7, r: 2.2, fill: 'currentColor' }),
            h('circle', { cx: 15, cy: 12, r: 2.2, fill: 'currentColor' }),
            h('circle', { cx: 8, cy: 17, r: 2.2, fill: 'currentColor' }),
          ]);
        case 'bell':
          return h('svg', svgAttrs, [
            h('path', { d: 'M6 9a6 6 0 0112 0c0 6 2 7 2 7H4s2-1 2-7z' }),
            h('path', { d: 'M10 20a2 2 0 004 0' }),
          ]);
        case 'help':
          return h('svg', svgAttrs, [
            h('circle', { cx: 12, cy: 12, r: 9 }),
            h('path', { d: 'M9.5 9a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 4' }),
            h('line', { x1: 12, y1: 17.5, x2: 12, y2: 17.5 }),
          ]);
        default:
          return h('svg', svgAttrs, []);
      }
    };
  },
});

interface MenuItem {
  label: string;
  to: string;
  icon: string;
}
interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const auth = useAuth();
const isCollapse = ref(false);

const menuGroups = computed<MenuGroup[]>(() => {
  const groups: MenuGroup[] = [{ title: '概览', items: [{ label: '经营概览', to: '/', icon: 'dashboard' }] }];
  if (authStore.hasPermission('products.read')) {
    groups.push({
      title: '商品',
      items: [
        { label: '商品管理', to: '/products', icon: 'box' },
        { label: '商品资料', to: '/products/catalog', icon: 'box' },
      ],
    });
  }
  if (authStore.hasPermission('orders.read')) {
    groups.push({
      title: '订单',
      items: [
        { label: '订单运营', to: '/orders', icon: 'truck' },
        ...(authStore.hasPermission('webhooks.replay')
          ? [{ label: '回调异常', to: '/operations/webhooks', icon: 'truck' }]
          : []),
      ],
    });
  }
  groups.push({
    title: '用户',
    items: [{ label: '会员管理', to: '/members', icon: 'user' }],
  });
  groups.push({
    title: '营销',
    items: [{ label: '创建活动', to: '/marketing/campaigns/new', icon: 'tag' }],
  });
  groups.push({
    title: '设置',
    items: [
      { label: '店铺设置', to: '/settings/shop', icon: 'settings' },
      ...(authStore.hasPermission('products.read')
        ? [{ label: '媒体监管', to: '/operations/media', icon: 'settings' }]
        : []),
    ],
  });
  return groups;
});

const activePath = computed(() => route.path);
const shopId = ref(authStore.session?.tenant.id ?? 'demo-jewelry');
const shopOptions = [
  { value: 'demo-jewelry', label: '臻品奢物 · 旗舰店' },
  { value: 'demo-watch', label: '时计阁 · 腕表专营' },
  { value: 'demo-bag', label: '包袋汇 · 手袋寄售' },
];

function handleShopChange(): void {
  ElMessage.info('切换店铺需要重新登录以重建安全会话');
  shopId.value = authStore.session?.tenant.id ?? 'demo-jewelry';
}

async function handleLogout(): Promise<void> {
  await auth.logout();
  ElMessage.success('已安全退出');
  await router.replace('/login');
}
</script>

<template>
  <el-container class="min-h-screen bg-[var(--pc-bg-page)]">
    <el-aside class="flex min-h-screen flex-col bg-[var(--pc-sidebar-bg)] transition-all" :width="isCollapse ? '64px' : '220px'">
      <div class="flex h-14 items-center gap-3 px-4 text-white">
        <div class="flex h-8 w-8 flex-none items-center justify-center rounded bg-[var(--pc-primary)] font-semibold">
          S
        </div>
        <span v-show="!isCollapse" class="whitespace-nowrap text-base font-medium">商家管理后台</span>
      </div>
      <el-menu
        :default-active="activePath"
        :collapse="isCollapse"
        active-text-color="#FFFFFF"
        background-color="#0F172A"
        class="flex-1 border-r-0"
        router
        text-color="#94A3B8"
      >
        <el-menu-item-group v-for="group in menuGroups" :key="group.title" :title="group.title">
          <el-menu-item v-for="item in group.items" :key="item.to" :index="item.to">
            <MenuIcon :name="item.icon" />
            <template #title><span class="whitespace-nowrap">{{ item.label }}</span></template>
          </el-menu-item>
        </el-menu-item-group>
      </el-menu>
      <div class="border-t border-slate-700 px-4 py-4 text-xs text-[var(--pc-sidebar-muted)]">
        <p v-show="!isCollapse">SaaS Platform · 开发环境</p>
        <p v-show="!isCollapse" class="mt-1">v0.1.0</p>
      </div>
    </el-aside>
    <el-container>
      <el-header
        class="flex h-14 items-center justify-between border-b border-[var(--pc-border)] bg-[var(--pc-bg-surface)] px-4"
      >
        <div class="flex items-center gap-4">
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded text-[var(--pc-text-regular)] hover:bg-[var(--pc-bg-page)]"
            @click="isCollapse = !isCollapse"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <el-select v-model="shopId" class="w-56" placeholder="选择店铺" @change="handleShopChange">
            <el-option v-for="option in shopOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </div>
        <div class="flex items-center gap-3">
          <el-tooltip content="消息中心 · 3 条未读" placement="bottom">
            <el-badge :value="3" class="cursor-pointer">
              <span class="flex h-8 w-8 items-center justify-center rounded text-[var(--pc-text-regular)] hover:bg-[var(--pc-bg-page)]"
                ><MenuIcon name="bell"
              /></span>
            </el-badge>
          </el-tooltip>
          <el-tooltip content="帮助中心" placement="bottom">
            <span class="flex h-8 w-8 cursor-pointer items-center justify-center rounded text-[var(--pc-text-regular)] hover:bg-[var(--pc-bg-page)]"
              ><MenuIcon name="help"
            /></span>
          </el-tooltip>
          <el-dropdown trigger="click">
            <button
              class="flex items-center gap-2 whitespace-nowrap text-sm text-[var(--pc-text-regular)]"
              type="button"
            >
              <span class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--pc-primary-soft)] font-medium text-[var(--pc-primary)]"
                >{{ authStore.session?.user.displayName.slice(0, 1) ?? '管' }}</span
              >
              {{ authStore.session?.user.displayName ?? '管理员' }}
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="handleLogout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="min-w-0 p-6"><RouterView /></el-main>
    </el-container>
  </el-container>
</template>
