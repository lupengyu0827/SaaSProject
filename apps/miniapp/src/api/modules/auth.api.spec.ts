/** 小程序认证 API 单元测试。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ensureCustomerAccessToken } from './auth.api';

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
        data: { accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 900 },
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
      options.success?.({ data: {}, statusCode: 200, header: {}, cookies: [] });
      return {} as UniApp.RequestTask;
    });
    vi.stubGlobal('uni', createUniMock(login, request));

    await expect(ensureCustomerAccessToken()).rejects.toThrow('登录服务返回了无效会话');
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
