import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { CreateAuditLogRequest } from '@saas/contracts';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';

import type { SaasRequest } from './request-context.js';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<SaasRequest>();
    return next.handle().pipe(
      tap(() => {
        if (
          request.tenantId &&
          request.actor &&
          !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
        ) {
          void this.write({
            tenantId: request.tenantId,
            actorId: request.actor.id,
            actorType: request.actor.type,
            action: request.method.toLowerCase(),
            resourceType: normalizeResourceType(request.path),
            requestId: request.header('x-request-id') ?? crypto.randomUUID(),
            ip: request.ip,
            userAgent: request.header('user-agent'),
          });
        }
      }),
    );
  }

  private async write(input: CreateAuditLogRequest): Promise<void> {
    const coreBaseUrl = process.env.CORE_BASE_URL ?? 'http://localhost:3101';
    try {
      await fetch(`${coreBaseUrl}/api/internal/audit-logs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
    } catch {
      // Audit delivery will move to a durable queue when the event bus is introduced.
    }
  }
}

/** 将实例路径归一化为稳定且满足审计表长度约束的资源类型。 */
function normalizeResourceType(path: string): string {
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ':id')
    .slice(0, 50);
}
