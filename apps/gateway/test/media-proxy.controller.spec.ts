/** Gateway 媒体代理测试：验证租户上下文和监管查询转发。 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MediaProxyController } from '../src/media/media-proxy.controller.js';
import type { SaasRequest } from '../src/pipeline/request-context.js';

afterEach(() => vi.unstubAllGlobals());

describe('MediaProxyController', () => {
  it('forwards admin media query with trusted request context', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ list: [], total: 0, page: 1, pageSize: 20 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const request = {
      tenantId: 'tenant-1',
      actor: { id: 'actor-1' },
    } as SaasRequest;

    await expect(
      new MediaProxyController().listForAdmin(request, {
        status: 'temporary',
        page: 2,
        pageSize: 10,
      }),
    ).resolves.toMatchObject({ total: 0, page: 1 });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/internal/media/admin/assets?status=temporary&page=2&pageSize=10');
    expect(init.headers).toMatchObject({ 'x-tenant-id': 'tenant-1', 'x-actor-id': 'actor-1' });
  });

  it('rejects forwarding when gateway context is missing', async () => {
    await expect(new MediaProxyController().listForAdmin({} as SaasRequest, {})).rejects.toThrow(
      'Gateway request context is missing',
    );
  });
});
