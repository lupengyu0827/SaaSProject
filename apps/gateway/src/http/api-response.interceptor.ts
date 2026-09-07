/** Gateway 对外成功响应包装器；流式响应和无内容响应保持原协议。 */
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { ApiResponse } from '@saas/contracts';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { map } from 'rxjs';

import { resolveTraceId } from './request-trace.js';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const traceId = resolveTraceId(request, response);

    return next.handle().pipe(
      map((data: unknown) => {
        if (shouldKeepRawResponse(response, data)) return data;
        const payload: ApiResponse<unknown> = { code: 0, message: 'ok', data, traceId };
        return payload;
      }),
    );
  }
}

function shouldKeepRawResponse(response: Response, data: unknown): boolean {
  if (response.statusCode === 204 || data === undefined) return true;
  const contentType = response.getHeader('content-type');
  return typeof contentType === 'string' && !contentType.includes('application/json');
}
