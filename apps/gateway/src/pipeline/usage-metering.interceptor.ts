import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';

import { RedisService } from '../infrastructure/redis.service.js';
import { USAGE_METRIC } from './pipeline.metadata.js';
import type { SaasRequest } from './request-context.js';

@Injectable()
export class UsageMeteringInterceptor implements NestInterceptor {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(RedisService)
    private readonly redis: RedisService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metric = this.reflector.getAllAndOverride<string>(USAGE_METRIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<SaasRequest>();

    return next.handle().pipe(
      tap(() => {
        if (metric && request.tenantId) void this.increment(request.tenantId, metric);
      }),
    );
  }

  private async increment(tenantId: string, metric: string): Promise<void> {
    const period = new Date().toISOString().slice(0, 7);
    try {
      await (await this.redis.getClient()).incr(`usage:${tenantId}:${metric}:${period}`);
    } catch {
      const coreBaseUrl = process.env.CORE_BASE_URL ?? 'http://localhost:3101';
      await fetch(`${coreBaseUrl}/api/platform/tenants/${tenantId}/usage/${metric}`, {
        method: 'POST',
      });
    }
  }
}
