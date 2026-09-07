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

  it('injects tenant, token and request id and unwraps Gateway envelope', async () => {
    const request = vi.fn((options: UniApp.RequestOptions) => {
      options.success?.({
        data: { code: 0, message: 'ok', data: { ok: true }, traceId: 'trace-1' },
        statusCode: 200,
        header: {},
        cookies: [],
      });
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

  it('passes through bare payloads without an envelope', async () => {
    const request = vi.fn((options: UniApp.RequestOptions) => {
      options.success?.({ data: { list: [] }, statusCode: 200, header: {}, cookies: [] });
      return {} as UniApp.RequestTask;
    });
    installUniMock(request);

    await expect(requestApi<{ list: unknown[] }>({ path: '/products' })).resolves.toEqual({
      list: [],
    });
  });

  it('surfaces backend message from an error envelope', async () => {
    const request = vi.fn((options: UniApp.RequestOptions) => {
      options.success?.({
        data: { code: 40300, message: '无权限', data: null, traceId: 'trace-2' },
        statusCode: 403,
        header: {},
        cookies: [],
      });
      return {} as UniApp.RequestTask;
    });
    installUniMock(request);

    await expect(requestApi({ path: '/products' })).rejects.toThrow('无权限');
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
