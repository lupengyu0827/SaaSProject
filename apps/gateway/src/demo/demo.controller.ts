import { Controller, Get, Post } from '@nestjs/common';

import {
  EnforceQuota,
  MeterUsage,
  RequireFeature,
  RequirePermission,
} from '../pipeline/pipeline.metadata.js';

@Controller('demo')
export class DemoController {
  @Get('advanced-report')
  @RequireFeature('reports.advanced')
  @EnforceQuota('api_calls')
  @MeterUsage('api_calls')
  @RequirePermission('reports.read')
  getAdvancedReport(): { message: string } {
    return { message: 'Advanced report access granted' };
  }

  @Post('advanced-report/refresh')
  @RequireFeature('reports.advanced')
  @EnforceQuota('api_calls')
  @MeterUsage('api_calls')
  @RequirePermission('reports.refresh')
  refreshAdvancedReport(): { message: string } {
    return { message: 'Advanced report refresh accepted' };
  }
}
