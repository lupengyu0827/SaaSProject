import { Controller, Delete, ForbiddenException, Headers, Param } from '@nestjs/common';

import { Public } from './pipeline.metadata.js';
import { TenantStateClient } from './tenant-state.client.js';

@Controller('internal/cache')
@Public()
export class CacheInvalidationController {
  constructor(private readonly stateClient: TenantStateClient) {}

  @Delete('tenants/:tenantId')
  async invalidate(
    @Param('tenantId') tenantId: string,
    @Headers('x-internal-key') internalKey?: string,
  ): Promise<{ invalidated: true }> {
    if (internalKey !== (process.env.INTERNAL_API_KEY ?? 'local-internal-key')) {
      throw new ForbiddenException('Invalid internal key');
    }
    await this.stateClient.invalidate(tenantId);
    return { invalidated: true };
  }
}
