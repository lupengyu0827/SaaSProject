/** 消费者认证 Gateway 代理测试：可信租户、轮换上下文和会话身份透传。 */
import { BadRequestException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MiniappAuthController } from '../src/auth/miniapp-auth.controller.js';
import type { SaasRequest } from '../src/pipeline/request-context.js';

describe('MiniappAuthController', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects refresh when the trusted tenant header is missing', () => {
    expect(() =>
      new MiniappAuthController().refresh(undefined, { refreshToken: 'current-refresh' }),
    ).toThrow(BadRequestException);
  });

  it('forwards refresh with tenant and request context', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        accessToken: 'access',
        refreshToken: 'next-refresh',
        expiresIn: 900,
        customer: { id: 'customer-a', displayName: null },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await new MiniappAuthController().refresh(
      'tenant-a',
      { refreshToken: 'current-refresh' },
      'request-a',
      'test-agent',
    );

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(url).toBe('http://localhost:3101/api/auth/miniapp/refresh');
    expect(init?.method).toBe('POST');
    expect(headers.get('x-tenant-id')).toBe('tenant-a');
    expect(headers.get('x-request-id')).toBe('request-a');
    expect(headers.get('user-agent')).toBe('test-agent');
    expect(init?.body).toBe(JSON.stringify({ refreshToken: 'current-refresh' }));
  });

  it('forwards the Gateway-verified customer identity to session', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ tenantId: 'tenant-a', customer: { id: 'customer-a', displayName: null } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const request = {
      tenantId: 'tenant-a',
      actor: { id: 'customer-a', type: 'customer' },
      header: () => undefined,
    } as unknown as SaasRequest;

    await new MiniappAuthController().session(request);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(url).toBe('http://localhost:3101/api/auth/miniapp/session');
    expect(init?.method).toBe('GET');
    expect(headers.get('x-tenant-id')).toBe('tenant-a');
    expect(headers.get('x-actor-id')).toBe('customer-a');
  });
});

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
