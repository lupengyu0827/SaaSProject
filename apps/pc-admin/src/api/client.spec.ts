/** PC API Client 单元测试：验证请求上下文与并发单次刷新。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestAuthApi } from './client';

const storage = new Map<string, string>();

describe('pc admin api client', () => {
  beforeEach(() => {
    storage.clear();
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    vi.stubGlobal('crypto', { randomUUID: () => 'request-id-1' });
  });

  it('injects the stored tenant, access token and request id', async () => {
    storage.set('tenantId', 'tenant-1');
    storage.set('accessToken', 'access-1');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestAuthApi('/session', { authenticated: true })).resolves.toEqual({
      ok: true,
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer access-1',
      'X-Tenant-Id': 'tenant-1',
      'X-Request-Id': 'request-id-1',
    });
  });

  it('shares one refresh across concurrent unauthorized requests', async () => {
    storage.set('tenantId', 'tenant-1');
    storage.set('accessToken', 'expired-access');
    storage.set('refreshToken', 'refresh-1');
    const refreshedAccessToken = tokenForTenant('tenant-1');
    let refreshCalls = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/admin/auth/refresh')) {
        refreshCalls += 1;
        return Promise.resolve(
          jsonResponse({
            accessToken: refreshedAccessToken,
            refreshToken: 'refresh-2',
            expiresIn: 900,
          }),
        );
      }
      const authorization = (init?.headers as Record<string, string>).Authorization;
      return Promise.resolve(
        authorization === `Bearer ${refreshedAccessToken}`
          ? jsonResponse({ ok: true })
          : jsonResponse({ message: 'expired' }, 401),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      Promise.all([
        requestAuthApi('/session', { authenticated: true }),
        requestAuthApi('/session', { authenticated: true }),
      ]),
    ).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
    expect(storage.get('refreshToken')).toBe('refresh-2');
  });
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function tokenForTenant(tenantId: string): string {
  const payload = Buffer.from(JSON.stringify({ tenantId })).toString('base64url');
  return `header.${payload}.signature`;
}
