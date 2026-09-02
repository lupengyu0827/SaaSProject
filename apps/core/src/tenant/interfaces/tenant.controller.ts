import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import type {
  RegisterTenantRequest,
  RegisterTenantResponse,
  TenantAccessState,
} from '@saas/contracts';

import { UsageMeterService } from '../../billing/application/usage-meter.service.js';
import { RegisterTenantService } from '../application/register-tenant.service.js';
import { TenantAccessService } from '../application/tenant-access.service.js';
import { TenantContextResolver } from '../application/tenant-context.resolver.js';
import type { TenantDbContext } from '../domain/tenant-db-context.js';

@Controller('platform/tenants')
export class TenantController {
  constructor(
    @Inject(RegisterTenantService)
    private readonly registerTenant: RegisterTenantService,
    @Inject(TenantAccessService)
    private readonly access: TenantAccessService,
    @Inject(TenantContextResolver)
    private readonly contextResolver: TenantContextResolver,
    @Inject(UsageMeterService)
    private readonly usage: UsageMeterService,
  ) {}

  @Post()
  register(@Body() input: RegisterTenantRequest): Promise<RegisterTenantResponse> {
    return this.registerTenant.execute(input);
  }

  @Get(':tenantId/access-state')
  getAccessState(@Param('tenantId') tenantId: string): Promise<TenantAccessState> {
    return this.access.getState(tenantId);
  }

  @Get(':tenantId/db-context')
  getDbContext(@Param('tenantId') tenantId: string): Promise<TenantDbContext> {
    return this.contextResolver.resolve(tenantId);
  }

  @Post(':tenantId/usage/:metricKey')
  async meter(
    @Param('tenantId') tenantId: string,
    @Param('metricKey') metricKey: string,
    @Body() input?: { amount?: number },
  ): Promise<{ accepted: true }> {
    await this.usage.increment(tenantId, metricKey, input?.amount ?? 1);
    return { accepted: true };
  }
}
