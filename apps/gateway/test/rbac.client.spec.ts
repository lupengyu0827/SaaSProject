import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { RedisService } from '../src/infrastructure/redis.service.js';
import { RbacClient } from '../src/pipeline/rbac.client.js';

describe('RbacClient', () => {
  it('rejects an actor missing the required permission', async () => {
    const redis = {
      getClient: vi.fn().mockResolvedValue({
        get: vi.fn().mockResolvedValue(JSON.stringify(['reports.read'])),
      }),
    } as unknown as RedisService;

    await expect(
      new RbacClient(redis).enforce('tenant-a', 'actor-a', 'reports.refresh'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an actor with the required permission', async () => {
    const redis = {
      getClient: vi.fn().mockResolvedValue({
        get: vi.fn().mockResolvedValue(JSON.stringify(['reports.refresh'])),
      }),
    } as unknown as RedisService;

    await expect(
      new RbacClient(redis).enforce('tenant-a', 'actor-a', 'reports.refresh'),
    ).resolves.toBeUndefined();
  });
});
