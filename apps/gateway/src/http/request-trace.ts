/** Gateway 请求链路标识：优先沿用合法客户端 ID，否则生成服务端 ID。 */
import type { Request, Response } from 'express';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;

export function resolveTraceId(request: Request, response: Response): string {
  const supplied = request.header('x-request-id');
  const traceId = supplied && REQUEST_ID_PATTERN.test(supplied) ? supplied : crypto.randomUUID();
  response.setHeader('x-request-id', traceId);
  return traceId;
}
