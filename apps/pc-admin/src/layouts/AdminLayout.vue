<script setup lang="ts">
/** PC 商家后台标准布局：深色侧栏、56px 顶栏和轻量商务内容区。 */
import { ElMessage } from 'element-plus';
import { computed } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';

import { useAuth } from '../composables/use-auth';
import { useAuthStore } from '../stores/use-auth-store';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const auth = useAuth();
const navigation = computed(() => [
  { label: '经营概览', to: '/' },
  ...(authStore.hasPermission('products.read') ? [{ label: '商品管理', to: '/products' }] : []),
  ...(authStore.hasPermission('products.read')
    ? [{ label: '商品资料', to: '/products/catalog' }]
    : []),
  ...(authStore.hasPermission('orders.read') ? [{ label: '订单运营', to: '/orders' }] : []),
  ...(authStore.hasPermission('webhooks.replay')
    ? [{ label: '回调异常', to: '/operations/webhooks' }]
    : []),
  ...(authStore.hasPermission('products.read')
    ? [{ label: '媒体监管', to: '/operations/media' }]
    : []),
]);
const activePath = computed(() => route.path);

async function handleLogout(): Promise<void> {
  await auth.logout();
  ElMessage.success('已安全退出');
  await router.replace('/login');
}
</script>

<template>
  <el-container class="min-h-screen bg-[var(--pc-bg-page)]">
    <el-aside class="flex min-h-screen flex-col bg-[var(--pc-sidebar-bg)]" width="220px">
      <div class="flex h-14 items-center gap-3 px-5 text-white">
        <div
          class="flex h-8 w-8 items-center justify-center rounded bg-[var(--pc-primary)] font-semibold"
        >
          S
        </div>
        <span class="whitespace-nowrap text-base font-medium">商家管理后台</span>
      </div>
      <el-menu
        :default-active="activePath"
        active-text-color="#FFFFFF"
        background-color="#0F172A"
        class="flex-1 border-r-0"
        router
        text-color="#94A3B8"
      >
        <el-menu-item v-for="item in navigation" :key="item.to" :index="item.to">
          <span class="whitespace-nowrap">{{ item.label }}</span>
        </el-menu-item>
      </el-menu>
      <div class="border-t border-slate-700 px-5 py-4 text-xs text-[var(--pc-sidebar-muted)]">
        SaaS Platform · 开发环境
      </div>
    </el-aside>
    <el-container>
      <el-header
        class="flex h-14 items-center justify-between border-b border-[var(--pc-border)] bg-[var(--pc-bg-surface)] px-6"
      >
        <div>
          <p class="text-sm font-medium text-[var(--pc-text-primary)]">
            {{ authStore.session?.tenant.name ?? '当前租户' }}
          </p>
          <p class="text-xs text-[var(--pc-text-secondary)]">
            {{ authStore.session?.tenant.subdomain }}
          </p>
        </div>
        <el-dropdown trigger="click">
          <button
            class="flex items-center gap-3 whitespace-nowrap text-sm text-[var(--pc-text-regular)]"
            type="button"
          >
            <span
              class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--pc-primary-soft)] font-medium text-[var(--pc-primary)]"
              >{{ authStore.session?.user.displayName.slice(0, 1) ?? '管' }}</span
            >
            {{ authStore.session?.user.displayName ?? '管理员' }}
          </button>
          <template #dropdown>
            <el-dropdown-menu
              ><el-dropdown-item @click="handleLogout">退出登录</el-dropdown-item></el-dropdown-menu
            >
          </template>
        </el-dropdown>
      </el-header>
      <el-main class="min-w-0 p-6"><RouterView /></el-main>
    </el-container>
  </el-container>
</template>
