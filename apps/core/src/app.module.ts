import { Module } from '@nestjs/common';

import { BillingModule } from './billing/billing.module.js';
import { CommerceModule } from './commerce/commerce.module.js';
import { ExtensionModule } from './extension/extension.module.js';
import { HealthController } from './health/health.controller.js';
import { OperationsModule } from './operations/operations.module.js';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module.js';
import { TenantModule } from './tenant/tenant.module.js';
import { AuthModule } from './auth/auth.module.js';
import { MediaModule } from './media/media.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BillingModule,
    TenantModule,
    CommerceModule,
    OperationsModule,
    ExtensionModule,
    MediaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
