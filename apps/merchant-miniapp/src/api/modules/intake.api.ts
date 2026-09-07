/** 商家商品入库 API：入库选项（分类/品牌/员工/回收类型/系列/型号）与提交入库。 */
import type {
  BrandModelResponse,
  BrandSeriesResponse,
  CreateProductIntakeRequest,
  IntakeBrandResponse,
  IntakeCategoryResponse,
  IntakeEmployeeResponse,
  ProductIntakeResponse,
  RecyclingTypeResponse,
} from '@saas/contracts';

import {
  getMerchantAccessToken,
  getMerchantApiBaseUrl,
  getMerchantTenantId,
} from '../../config/runtime';
import { unwrapApiData } from '../envelope';
import { MerchantApiError } from '../errors';

type QueryValue = string | number | boolean | undefined;

function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
  data?: unknown,
  query: Record<string, QueryValue> = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const accessToken = getMerchantAccessToken();
    const tenantId = getMerchantTenantId();
    if (!accessToken || !tenantId) {
      reject(new MerchantApiError('请先登录店铺'));
      return;
    }
    const queryString = Object.entries(query)
      .filter((entry): entry is [string, Exclude<QueryValue, undefined>] => entry[1] !== undefined)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');
    void uni.request({
      url: `${getMerchantApiBaseUrl()}${path}${queryString ? `?${queryString}` : ''}`,
      method: method as UniApp.RequestOptions['method'],
      data: data as UniApp.RequestOptions['data'],
      header: {
        Authorization: `Bearer ${accessToken}`,
        'X-Tenant-Id': tenantId,
        'X-Request-Id': `merchant-intake-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        'content-type': 'application/json',
      },
      timeout: 15_000,
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(unwrapApiData(response.data) as T);
        } else reject(new MerchantApiError(errorMessage(response.data), response.statusCode));
      },
      fail: (failure) => reject(new MerchantApiError(failure.errMsg || '网络连接失败')),
    });
  });
}

/** 入库分类列表（箱包/珠宝/服饰/其他/配饰）。 */
export function getIntakeCategories(): Promise<IntakeCategoryResponse[]> {
  return request<IntakeCategoryResponse[]>('/commerce/intake-options/categories');
}

/** 品牌库列表。 */
export function getIntakeBrands(): Promise<IntakeBrandResponse[]> {
  return request<IntakeBrandResponse[]>('/commerce/intake-options/brands');
}

/** 店铺员工（鉴定/回收人员选项）。 */
export function getIntakeEmployees(): Promise<IntakeEmployeeResponse[]> {
  return request<IntakeEmployeeResponse[]>('/commerce/intake-options/employees');
}

/** 回收类型选项。 */
export function getRecyclingTypes(): Promise<RecyclingTypeResponse[]> {
  return request<RecyclingTypeResponse[]>('/commerce/intake-options/recycling-types');
}

/** 品牌下系列列表。 */
export function getBrandSeries(brandId: string): Promise<BrandSeriesResponse[]> {
  return request<BrandSeriesResponse[]>(
    `/commerce/intake-options/brands/${encodeURIComponent(brandId)}/series`,
  );
}

/** 品牌下型号列表。 */
export function getBrandModels(brandId: string): Promise<BrandModelResponse[]> {
  return request<BrandModelResponse[]>(
    `/commerce/intake-options/brands/${encodeURIComponent(brandId)}/models`,
  );
}

/** 提交商品入库（幂等）。 */
export function createProductIntake(
  input: CreateProductIntakeRequest,
): Promise<ProductIntakeResponse> {
  return request<ProductIntakeResponse>('/commerce/product-intakes', 'POST', input);
}

function errorMessage(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'message' in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '入库服务暂时不可用';
}
