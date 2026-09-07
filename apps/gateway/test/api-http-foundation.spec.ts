/** Gateway API 基础设施回归：统一响应、错误、链路 ID 与关键 DTO 校验。 */
import {
  BadRequestException,
  ConflictException,
  type CallHandler,
  type ExecutionContext,
} from '@nestjs/common';
import { ProductDraftErrorCode, type ApiErrorResponse } from '@saas/contracts';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { AdminLoginDto } from '../src/http/dto/auth.dto.js';
import {
  DeleteProductDraftDto,
  ProductDraftListQueryDto,
  SaveProductDraftDto,
} from '../src/http/dto/product-draft.dto.js';
import { ApiExceptionFilter } from '../src/http/api-exception.filter.js';
import { ApiResponseInterceptor } from '../src/http/api-response.interceptor.js';
import { ProductLifecycleCommandDto } from '../src/http/dto/product-lifecycle.dto.js';
import {
  BrandDirectoryQueryDto,
  BrandModelListQueryDto,
  CreateProductIntakeDto,
} from '../src/http/dto/product-intake.dto.js';

describe('Gateway API HTTP foundation', () => {
  it('wraps JSON success responses and echoes a valid request ID', async () => {
    const response = createResponse();
    const context = createContext({ 'x-request-id': 'client-request-01' }, response);
    const next: CallHandler = { handle: () => of({ service: 'gateway' }) };

    await expect(
      firstValueFrom(new ApiResponseInterceptor().intercept(context, next)),
    ).resolves.toEqual({
      code: 0,
      message: 'ok',
      data: { service: 'gateway' },
      traceId: 'client-request-01',
    });
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', 'client-request-01');
  });

  it('maps validation failures to a stable 400 response', () => {
    const response = createResponse();
    const context = createContext({}, response);
    const exception = new BadRequestException({ message: ['email must be an email'] });

    new ApiExceptionFilter().catch(exception, context);

    expect(response.status).toHaveBeenCalledWith(400);
    const payload = response.json.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      code: 40000,
      message: '请求参数校验失败',
      data: { errors: ['email must be an email'] },
    });
    expect(payload?.traceId).toEqual(expect.any(String));
  });

  it('preserves the stable product draft version conflict code and data', () => {
    const response = createResponse();
    const context = createContext({}, response);
    const exception = new ConflictException({
      code: ProductDraftErrorCode.VERSION_CONFLICT,
      message: '草稿已在其他设备修改，请刷新后重试',
      data: { currentVersion: 3 },
    });

    new ApiExceptionFilter().catch(exception, context);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json.mock.calls[0]?.[0]).toMatchObject({
      code: 40901,
      message: '草稿已在其他设备修改，请刷新后重试',
      data: { currentVersion: 3 },
    });
  });

  it('rejects invalid admin login data', async () => {
    const dto = plainToInstance(AdminLoginDto, {
      subdomain: '',
      email: 'not-an-email',
      password: 'short',
    });
    expect(await validate(dto)).toHaveLength(3);
  });

  it('rejects invalid draft money and version values', async () => {
    const dto = plainToInstance(SaveProductDraftDto, { version: -1, price: '12.345' });
    expect(await validate(dto)).toHaveLength(2);
  });

  it('transforms draft pagination and rejects invalid deletion versions', async () => {
    const query = plainToInstance(ProductDraftListQueryDto, { page: '2', pageSize: '10' });
    expect(await validate(query)).toHaveLength(0);
    expect(query).toMatchObject({ page: 2, pageSize: 10 });

    const deletion = plainToInstance(DeleteProductDraftDto, { version: -1 });
    expect(await validate(deletion)).toHaveLength(1);
  });

  it('requires lifecycle version and an auditable reason', async () => {
    const invalid = plainToInstance(ProductLifecycleCommandDto, { version: -1, reason: 'x' });
    expect(await validate(invalid)).toHaveLength(2);
    const valid = plainToInstance(ProductLifecycleCommandDto, {
      version: 3,
      reason: '商品资料需要调整',
    });
    expect(await validate(valid)).toHaveLength(0);
  });

  it('enforces product intake required fields, media limits and money precision', async () => {
    const invalid = plainToInstance(CreateProductIntakeDto, {
      idempotencyKey: 'short',
      action: 'unknown',
      title: '',
      description: '',
      condition: 'new',
      categoryId: 'bad',
      brandId: 'bad',
      stockQuantity: 0,
      totalCostPrice: '1.999',
      appraiserEmployeeId: 'bad',
      recycledAt: 'not-a-date',
      warrantyCard: 'unknown',
      productImageAssetIds: [],
    });
    expect((await validate(invalid)).length).toBeGreaterThanOrEqual(12);

    const valid = plainToInstance(CreateProductIntakeDto, {
      idempotencyKey: 'intake-request-001',
      action: 'stock_only',
      title: '测试商品',
      description: '商品描述',
      condition: 'preowned',
      categoryId: '11111111-1111-4111-8111-111111111111',
      brandId: '22222222-2222-4222-8222-222222222222',
      stockQuantity: 1,
      appraiserEmployeeId: '33333333-3333-4333-8333-333333333333',
      recycledAt: '2026-09-04T00:00:00.000Z',
      warrantyCard: 'present',
      warrantyCardYear: 2024,
      productImageAssetIds: ['44444444-4444-4444-8444-444444444444'],
      accessories: ['box', 'receipt'],
    });
    expect(await validate(valid)).toHaveLength(0);
  });

  it('validates brand keyword, category and series filters', async () => {
    const validDirectory = plainToInstance(BrandDirectoryQueryDto, {
      categoryId: '11111111-1111-4111-8111-111111111111',
      keyword: 'Cartier',
    });
    expect(await validate(validDirectory)).toHaveLength(0);
    expect(
      await validate(plainToInstance(BrandDirectoryQueryDto, { categoryId: 'bad' })),
    ).toHaveLength(1);
    expect(
      await validate(plainToInstance(BrandModelListQueryDto, { seriesId: 'bad' })),
    ).toHaveLength(1);
  });
});

interface MockResponse {
  statusCode: number;
  setHeader: Mock<(name: string, value: string) => void>;
  getHeader: Mock<(name: string) => string>;
  status: Mock<(status: number) => MockResponse>;
  json: Mock<(payload: ApiErrorResponse) => void>;
}

function createResponse(): MockResponse {
  const response: MockResponse = {
    statusCode: 200,
    setHeader: vi.fn<(name: string, value: string) => void>(),
    getHeader: vi.fn<(name: string) => string>().mockReturnValue('application/json; charset=utf-8'),
    status: vi.fn<(status: number) => MockResponse>(),
    json: vi.fn<(payload: ApiErrorResponse) => void>(),
  };
  response.status.mockReturnValue(response);
  return response;
}

function createContext(headers: Record<string, string>, response: MockResponse): ExecutionContext {
  const request = { header: (name: string): string | undefined => headers[name] };
  return {
    switchToHttp: () => ({
      getRequest: (): typeof request => request,
      getResponse: (): MockResponse => response,
    }),
  } as unknown as ExecutionContext;
}
