import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { DemoController } from './demo/demo.controller.js';
import { HealthController } from './health/health.controller.js';
import { RedisService } from './infrastructure/redis.service.js';
import { GatewayPolicyEngine } from './pipeline/gateway-policy.engine.js';
import { SaasPipelineGuard } from './pipeline/saas-pipeline.guard.js';
import { TenantStateClient } from './pipeline/tenant-state.client.js';
import { UsageMeteringInterceptor } from './pipeline/usage-metering.interceptor.js';
import { UsageFlushService } from './pipeline/usage-flush.service.js';
import { RbacClient } from './pipeline/rbac.client.js';
import { AuditInterceptor } from './pipeline/audit.interceptor.js';
import { AuthTokenVerifier } from './pipeline/auth-token.verifier.js';
import { CoreProxyService } from './infrastructure/core-proxy.service.js';
import { CommerceProxyController } from './demo/commerce-proxy.controller.js';
import { CacheInvalidationController } from './pipeline/cache-invalidation.controller.js';
import { MiniappAuthController } from './auth/miniapp-auth.controller.js';

@Module({
  controllers: [
    HealthController,
    DemoController,
    CacheInvalidationController,
    CommerceProxyController,
    MiniappAuthController,
  ],
  providers: [
    RedisService,
    TenantStateClient,
    GatewayPolicyEngine,
    UsageFlushService,
    RbacClient,
    AuthTokenVerifier,
    CoreProxyService,
    { provide: APP_GUARD, useClass: SaasPipelineGuard },
    { provide: APP_INTERCEPTOR, useClass: UsageMeteringInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
