/** 管理员认证 API：组件与 Store 不直接接触 HTTP。 */
import type {
  AdminSessionResponse,
  AuthTokensResponse,
  LoginRequest,
  LogoutResponse,
} from '@saas/contracts';

import { requestAuthApi } from '../client';

export const authApi = {
  login(input: LoginRequest): Promise<AuthTokensResponse> {
    return requestAuthApi('/login', { method: 'POST', body: input });
  },
  session(): Promise<AdminSessionResponse> {
    return requestAuthApi('/session', { authenticated: true });
  },
  logout(refreshToken: string): Promise<LogoutResponse> {
    return requestAuthApi('/logout', { method: 'POST', body: { refreshToken } });
  },
};
