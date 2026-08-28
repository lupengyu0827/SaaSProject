import { Controller, Get } from '@nestjs/common';
import { SERVICE_NAMES, type HealthResponse } from '@saas/contracts';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      service: SERVICE_NAMES.CORE,
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
