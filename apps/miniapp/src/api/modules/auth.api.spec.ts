/** 小程序认证 API 单元测试。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ensureCustomerAccessToken, refreshCustomerSession } from './auth.api';

const storage = new Map<string, string>();

describe('miniapp auth api', () => {
  beforeEach(() => {
    storage.clear();
    storage.set('saas.currentTenantId', 'tenant-1');
  });

  it('shares one WeChat login across concurrent requests', async () => {
    const login = vi.fn((options: UniApp.LoginOptions) => {
      options.success?.({ code: 'wx-code', authResult: '', errMsg: 'login:ok' });
    });
    const request = vi.fn((options: UniApp.RequestOptions) => {
      options.success?.({
        data: {
          code: 0,
          message: 'ok',
          data: { accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 900 },
          traceId: 'trace-1',
        },
        statusCode: 200,
        header: {},
        cookies: [],
      });
      return {} as UniApp.RequestTask;
    });
    vi.stubGlobal('uni', createUniMock(login, request));

    await expect(
      Promise.all([ensureCustomerAccessToken(), ensureCustomerAccessToken()]),
    ).resolves.toEqual(['access-1', 'access-1']);
    expect(login).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
    expect(storage.get('saas.refreshToken')).toBe('refresh-1');
  });

  it('rejects malformed successful login responses', async () => {
    const login = vi.fn((options: UniApp.LoginOptions) => {
      options.success?.({ code: 'wx-code', authResult: '', errMsg: 'login:ok' });
    });
    const request = vi.fn((options: UniApp.RequestOptions) => {
      options.success?.({
        data: { code: 0, message: 'ok', data: {}, traceId: 'trace-1' },
        statusCode: 200,
        header: {},
        cookies: [],
      });
      return {} as UniApp.RequestTask;
    });
    vi.stubGlobal('uni', createUniMock(login, request));

    await expect(ensureCustomerAccessToken()).rejects.toThrow('登录服务返回了无效会话');
  });

  it('rotates the refresh token and persists the new session', async () => {
    storage.set('saas.refreshToken', 'refresh-1');
    const request = vi.fn((options: UniApp.RequestOptions) => {
      options.success?.({
        data: {
          code: 0,
          message: 'ok',
          data: { accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 900 },
          traceId: 'trace-1',
        },
        statusCode: 200,
        header: {},
        cookies: [],
      });
      return {} as UniApp.RequestTask;
    });
    vi.stubGlobal('uni', createUniMock(vi.fn(), request));

    const session = await refreshCustomerSession();
    expect(session.accessToken).toBe('access-2');
    expect(storage.get('saas.accessToken')).toBe('access-2');
    expect(storage.get('saas.refreshToken')).toBe('refresh-2');
  });
});

function createUniMock(
  login: ReturnType<typeof vi.fn>,
  request: ReturnType<typeof vi.fn>,
): {
  getStorageSync: (key: string) => string;
  setStorageSync: (key: string, value: string) => Map<string, string>;
  removeStorageSync: (key: string) => boolean;
  login: ReturnType<typeof vi.fn>;
  request: ReturnType<typeof vi.fn>;
} {
  return {
    getStorageSync: (key: string): string => storage.get(key) ?? '',
    setStorageSync: (key: string, value: string): Map<string, string> => storage.set(key, value),
    removeStorageSync: (key: string): boolean => storage.delete(key),
    login,
    request,
  };
}
