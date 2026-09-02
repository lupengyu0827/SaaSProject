/** 管理员会话 Store：仅保存当前会话和简单派生状态。 */
import type { AdminSessionResponse } from '@saas/contracts';
import { defineStore } from 'pinia';
import { computed, shallowRef } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  const session = shallowRef<AdminSessionResponse | null>(null);
  const isAuthenticated = computed(() => session.value !== null);

  function setSession(value: AdminSessionResponse | null): void {
    session.value = value;
  }

  function hasPermission(permission: string): boolean {
    return (
      session.value?.permissions.includes('*') === true ||
      session.value?.permissions.includes(permission) === true
    );
  }

  return { session, isAuthenticated, setSession, hasPermission };
});
