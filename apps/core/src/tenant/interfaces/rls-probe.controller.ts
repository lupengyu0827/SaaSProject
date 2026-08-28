import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { RlsTenantProbeService } from '../application/rls-tenant-probe.service.js';

@Controller('internal/rls-probes/:tenantId')
export class RlsProbeController {
  constructor(private readonly probes: RlsTenantProbeService) {}

  @Post()
  async create(
    @Param('tenantId') tenantId: string,
    @Body() payload: Record<string, unknown>,
  ): Promise<{ id: string }> {
    const probe = await this.probes.create(tenantId, payload);
    return { id: probe.id };
  }

  @Get()
  async list(
    @Param('tenantId') tenantId: string,
  ): Promise<Array<{ id: string; payload: unknown }>> {
    return (await this.probes.list(tenantId)).map(({ id, payload }) => ({ id, payload }));
  }
}
