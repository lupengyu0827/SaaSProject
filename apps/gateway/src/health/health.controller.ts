import { Controller, Get } from '@nestjs/common';
import { SERVICE_NAMES, type HealthResponse } from '@saas/contracts';

import { Public } from '../pipeline/pipeline.metadata.js';

@Controller('health')
@Public()
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      service: SERVICE_NAMES.GATEWAY,
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
