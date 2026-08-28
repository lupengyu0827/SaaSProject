/** 小程序统一 API Client 单元测试。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestApi } from './client';

const storage = new Map<string, string>();

describe('miniapp api client', () => {
  beforeEach(() => {
    storage.clear();
    storage.set('saas.currentTenantId', 'tenant-1');
    storage.set('saas.accessToken', 'access-1');
  });

  it('injects tenant, token and request id into requests', async () => {
    const request = vi.fn((options: UniApp.RequestOptions) => {
      options.success?.({ data: { ok: true }, statusCode: 200, header: {}, cookies: [] });
      return {} as UniApp.RequestTask;
    });
    installUniMock(request);

    await expect(
      requestApi<{ ok: boolean }>({ path: '/orders', method: 'POST', body: { sku: 'SKU-1' } }),
    ).resolves.toEqual({ ok: true });

    const options = request.mock.calls[0]?.[0];
    expect(options?.header).toMatchObject({
      Authorization: 'Bearer access-1',
      'X-Tenant-Id': 'tenant-1',
      'content-type': 'application/json',
    });
    expect((options?.header as Record<string, string>)['X-Request-Id']).toMatch(/^mini-/);
    expect(options?.data).toEqual({ sku: 'SKU-1' });
  });

  it('maps timeout failures to a page-safe error', async () => {
    const request = vi.fn((options: UniApp.RequestOptions) => {
      options.fail?.({ errMsg: 'request:fail timeout' });
      return {} as UniApp.RequestTask;
    });
    installUniMock(request);

    await expect(requestApi({ path: '/products' })).rejects.toThrow('请求超时，请检查网络后重试');
  });
});

function installUniMock(request: ReturnType<typeof vi.fn>): void {
  vi.stubGlobal('uni', {
    getStorageSync: (key: string) => storage.get(key) ?? '',
    setStorageSync: (key: string, value: string) => storage.set(key, value),
    removeStorageSync: (key: string) => storage.delete(key),
    request,
  });
}
