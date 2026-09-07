import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { ActorPermissionsResponse } from '@saas/contracts';

import { RedisService } from '../infrastructure/redis.service.js';

@Injectable()
export class RbacClient {
  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  async enforce(tenantId: string, actorId: string, permission?: string): Promise<void> {
    if (!permission) return;
    const key = `rbac:${tenantId}:${actorId}`;
    let permissions: string[] | undefined;
    try {
      const cached = await (await this.redis.getClient()).get(key);
      if (cached) permissions = JSON.parse(cached) as string[];
    } catch {
      // Continue with the source of truth.
    }
    if (!permissions) {
      const coreBaseUrl = process.env.CORE_BASE_URL ?? 'http://localhost:3101';
      const response = await fetch(
        `${coreBaseUrl}/api/platform/tenants/${tenantId}/actors/${actorId}/permissions`,
      );
      if (!response.ok) throw new ForbiddenException('Unable to resolve actor permissions');
      permissions = ((await response.json()) as ActorPermissionsResponse).permissions;
      try {
        await (await this.redis.getClient()).set(key, JSON.stringify(permissions), { EX: 30 });
      } catch {
        // Short outages do not bypass authorization; permissions were loaded from Core.
      }
    }
    if (!permissions.includes('*') && !permissions.includes(permission)) {
      throw new ForbiddenException(`Permission ${permission} is required`);
    }
  }
}
