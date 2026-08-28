import { HttpException, Injectable } from '@nestjs/common';

@Injectable()
export class CoreProxyService {
  async request<T>(
    path: string,
    context: { tenantId: string; actorId: string },
    init?: { method?: string; body?: unknown },
  ): Promise<T> {
    const coreBaseUrl = process.env.CORE_BASE_URL ?? 'http://localhost:3001';
    const response = await fetch(`${coreBaseUrl}/api/internal/commerce${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        'x-tenant-id': context.tenantId,
        'x-actor-id': context.actorId,
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const payload = (await response.json()) as T;
    if (!response.ok) throw new HttpException(payload as object, response.status);
    return payload;
  }
}
