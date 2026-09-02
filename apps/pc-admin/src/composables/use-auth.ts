/** 管理员认证流程编排：协调 API、持久化和 Auth Store。 */
import type { LoginRequest } from '@saas/contracts';

import { authApi } from '../api/modules/auth.api';
import {
  clearSessionStorage,
  persistTenantId,
  persistTokens,
  readRefreshToken,
} from '../auth/session-storage';
import { useAuthStore } from '../stores/use-auth-store';

interface UseAuthReturn {
  login(input: LoginRequest): Promise<void>;
  restore(): Promise<boolean>;
  logout(): Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const authStore = useAuthStore();

  async function login(input: LoginRequest): Promise<void> {
    try {
      persistTokens(await authApi.login(input));
      const session = await authApi.session();
      persistTenantId(session.tenant.id);
      authStore.setSession(session);
    } catch (error: unknown) {
      clearSessionStorage();
      authStore.setSession(null);
      throw error;
    }
  }

  async function restore(): Promise<boolean> {
    try {
      const session = await authApi.session();
      persistTenantId(session.tenant.id);
      authStore.setSession(session);
      return true;
    } catch {
      clearSessionStorage();
      authStore.setSession(null);
      return false;
    }
  }

  async function logout(): Promise<void> {
    const refreshToken = readRefreshToken();
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } finally {
      clearSessionStorage();
      authStore.setSession(null);
    }
  }

  return { login, restore, logout };
}
