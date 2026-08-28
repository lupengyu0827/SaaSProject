import type { Component } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
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
      ],
    },
  ],
});
