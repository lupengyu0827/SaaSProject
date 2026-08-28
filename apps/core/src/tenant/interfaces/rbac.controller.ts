import { Controller, Get, Param } from '@nestjs/common';
import type { ActorPermissionsResponse } from '@saas/contracts';

import { RbacService } from '../application/rbac.service.js';

@Controller('platform/tenants/:tenantId/actors')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get(':actorId/permissions')
  getPermissions(
    @Param('tenantId') tenantId: string,
    @Param('actorId') actorId: string,
  ): Promise<ActorPermissionsResponse> {
    return this.rbac.getActorPermissions(tenantId, actorId);
  }
}
