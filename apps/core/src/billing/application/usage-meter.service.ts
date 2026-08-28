import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class UsageMeterService {
  constructor(private readonly prisma: PrismaService) {}

  async increment(tenantId: string, metricKey: string, amount = 1): Promise<void> {
    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
    periodEnd.setUTCDate(0);

    await this.prisma.usageMetric.upsert({
      where: { tenantId_metricKey_periodStart: { tenantId, metricKey, periodStart } },
      create: { tenantId, metricKey, amount, periodStart, periodEnd },
      update: { amount: { increment: amount } },
    });
  }
}
