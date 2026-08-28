import { Module } from '@nestjs/common';

import { UsageMeterService } from './application/usage-meter.service.js';
import { ChangeSubscriptionService } from './application/change-subscription.service.js';
import { SubscriptionController } from './interfaces/subscription.controller.js';

@Module({
  controllers: [SubscriptionController],
  providers: [UsageMeterService, ChangeSubscriptionService],
  exports: [UsageMeterService],
})
export class BillingModule {}
