/** Gateway 统一异常出口：稳定业务错误码、友好消息与 traceId。 */
import { ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { ApiErrorResponse } from '@saas/contracts';
import type { Request, Response } from 'express';

import { resolveTraceId } from './request-trace.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const source = exception instanceof HttpException ? exception.getResponse() : null;
    const payload: ApiErrorResponse = {
      code: resolveErrorCode(status, source),
      message: resolveMessage(source, status),
      data: resolveErrorData(source),
      traceId: resolveTraceId(request, response),
    };
    response.status(status).json(payload);
  }
}

function resolveErrorCode(status: number, source: string | object | null): number {
  if (source && typeof source === 'object' && 'code' in source && typeof source.code === 'number') {
    return source.code;
  }
  const codes: Record<number, number> = {
    400: 40000,
    401: 40100,
    402: 40200,
    403: 40300,
    404: 40400,
    409: 40900,
    413: 41300,
    429: 42900,
  };
  return codes[status] ?? (status >= 500 ? 50000 : status * 100);
}

function resolveMessage(source: string | object | null, status: number): string {
  if (typeof source === 'string') return source;
  if (source && 'message' in source) {
    const message = source.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return '请求参数校验失败';
  }
  return status === 500 ? '服务暂时不可用' : '请求处理失败';
}

function resolveErrorData(source: string | object | null): unknown {
  if (!source || typeof source === 'string') return null;
  const record = source as Record<string, unknown>;
  return Array.isArray(record.message) ? { errors: record.message } : (record.data ?? null);
}
