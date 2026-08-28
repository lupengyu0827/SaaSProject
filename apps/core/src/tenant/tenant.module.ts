import { Module } from '@nestjs/common';

import { RegisterTenantService } from './application/register-tenant.service.js';
import { TenantAccessService } from './application/tenant-access.service.js';
import { TenantContextResolver } from './application/tenant-context.resolver.js';
import { TenantController } from './interfaces/tenant.controller.js';
import { RbacService } from './application/rbac.service.js';
import { AuditLogService } from './application/audit-log.service.js';
import { RbacController } from './interfaces/rbac.controller.js';
import { AuditController } from './interfaces/audit.controller.js';
import { RlsTenantProbeService } from './application/rls-tenant-probe.service.js';
import { RlsProbeController } from './interfaces/rls-probe.controller.js';

@Module({
  controllers: [TenantController, RbacController, AuditController, RlsProbeController],
  providers: [
    RegisterTenantService,
    TenantAccessService,
    TenantContextResolver,
    RbacService,
    AuditLogService,
    RlsTenantProbeService,
  ],
  exports: [TenantContextResolver],
})
export class TenantModule {}
