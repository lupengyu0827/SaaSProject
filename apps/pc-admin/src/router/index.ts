import type { Component } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';

import { readAccessToken, readRefreshToken } from '../auth/session-storage';
import { useAuth } from '../composables/use-auth';

let sessionRestoreAttempted = false;

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: async (): Promise<Component> =>
        (await import('../views/auth/LoginView.vue')).default,
      meta: { public: true },
    },
    {
      path: '/',
      component: async (): Promise<Component> =>
        (await import('../layouts/AdminLayout.vue')).default,
      children: [
        {
          path: '',
          name: 'dashboard',
          component: async (): Promise<Component> =>
            (await import('../views/dashboard/DashboardView.vue')).default,
        },
        {
          path: 'products',
          name: 'products',
          component: async (): Promise<Component> =>
            (await import('../views/products/ProductManagement.vue')).default,
        },
        {
          path: 'products/catalog',
          name: 'product-catalog',
          component: async (): Promise<Component> =>
            (await import('../views/products/CatalogManagement.vue')).default,
        },
        {
          path: 'orders',
          name: 'orders',
          component: async (): Promise<Component> =>
            (await import('../views/orders/OrderOperations.vue')).default,
        },
        {
          path: 'operations/webhooks',
          name: 'webhook-operations',
          component: async (): Promise<Component> =>
            (await import('../views/operations/WebhookOperations.vue')).default,
        },
        {
          path: 'operations/media',
          name: 'media-operations',
          component: async (): Promise<Component> =>
            (await import('../views/operations/MediaOperations.vue')).default,
        },
        {
          path: 'members',
          name: 'members',
          component: async (): Promise<Component> =>
            (await import('../views/members/MemberManagement.vue')).default,
        },
        {
          path: 'marketing/campaigns/new',
          name: 'campaign-create',
          component: async (): Promise<Component> =>
            (await import('../views/marketing/CampaignCreate.vue')).default,
        },
        {
          path: 'settings/shop',
          name: 'shop-settings',
          component: async (): Promise<Component> =>
            (await import('../views/settings/ShopSettings.vue')).default,
        },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  const hasTokens = Boolean(readAccessToken() || readRefreshToken());
  if (!to.meta.public && !hasTokens) return { name: 'login', query: { redirect: to.fullPath } };
  if (hasTokens && !sessionRestoreAttempted) {
    sessionRestoreAttempted = true;
    const restored = await useAuth().restore();
    if (!restored && !to.meta.public) return { name: 'login', query: { redirect: to.fullPath } };
    if (restored && to.name === 'login') return { name: 'dashboard' };
  }
  return true;
});
