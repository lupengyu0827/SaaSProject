import { Body, Controller, Param, Post } from '@nestjs/common';

import { ChangeSubscriptionService } from '../application/change-subscription.service.js';

@Controller('platform/tenants/:tenantId/subscription')
export class SubscriptionController {
  constructor(private readonly subscriptions: ChangeSubscriptionService) {}

  @Post('plan')
  async changePlan(
    @Param('tenantId') tenantId: string,
    @Body() input: { planCode: string },
  ): Promise<{ updated: true }> {
    await this.subscriptions.changePlan(tenantId, input.planCode);
    return { updated: true };
  }

  @Post('expire')
  async expire(@Param('tenantId') tenantId: string): Promise<{ updated: true }> {
    await this.subscriptions.expire(tenantId);
    return { updated: true };
  }
}
