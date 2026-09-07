import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

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
import { AdminAuthController } from './auth/admin-auth.controller.js';
import { MerchantAuthController } from './auth/merchant-auth.controller.js';
import { MediaProxyController } from './media/media-proxy.controller.js';
import { ApiExceptionFilter } from './http/api-exception.filter.js';
import { ApiResponseInterceptor } from './http/api-response.interceptor.js';

@Module({
  controllers: [
    HealthController,
    DemoController,
    CacheInvalidationController,
    CommerceProxyController,
    MiniappAuthController,
    AdminAuthController,
    MerchantAuthController,
    MediaProxyController,
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
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: UsageMeteringInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
