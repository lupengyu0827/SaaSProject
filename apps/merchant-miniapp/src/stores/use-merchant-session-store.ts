/** 商家会话 Store：只保存状态和简单权限派生，不发起 HTTP。 */
import type { AuthTokensResponse, MerchantSessionResponse } from '@saas/contracts';
import { computed, shallowRef } from 'vue';
import { defineStore } from 'pinia';

export type MerchantContext = Omit<MerchantSessionResponse, keyof AuthTokensResponse>;

export const useMerchantSessionStore = defineStore('merchant-session', () => {
  const context = shallowRef<MerchantContext | null>(null);
  const currentMerchant = computed(() => context.value?.merchant ?? null);
  const currentTenant = computed(() => context.value?.tenant ?? null);
  const permissions = computed(() => context.value?.permissions ?? []);

  /** 保存服务端确认的商家上下文。 */
  function setContext(value: MerchantContext): void {
    context.value = value;
  }

  /** 清理失效会话状态。 */
  function clear(): void {
    context.value = null;
  }

  /** 判断当前员工是否拥有权限。 */
  function hasPermission(permission: string): boolean {
    return permissions.value.includes(permission);
  }

  return { context, currentMerchant, currentTenant, permissions, setContext, clear, hasPermission };
});
