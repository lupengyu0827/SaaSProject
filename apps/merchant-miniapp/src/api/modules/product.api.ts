/** 商家商品草稿 API：统一注入商家令牌、租户与请求 ID。 */
import type {
  BindProductDraftMediaRequest,
  CatalogListQuery,
  CategoryResponse,
  CreateProductDraftRequest,
  ProductListQuery,
  ProductPageResponse,
  ProductPublishValidationResponse,
  ProductResponse,
  PublishProductDraftRequest,
  PublishProductDraftResponse,
  SaveProductDraftRequest,
} from '@saas/contracts';

import {
  getMerchantAccessToken,
  getMerchantApiBaseUrl,
  getMerchantTenantId,
} from '../../config/runtime';
import { MerchantApiError } from '../errors';

type QueryValue = string | number | boolean | undefined;

export function createProductDraft(
  input: CreateProductDraftRequest = {},
): Promise<ProductResponse> {
  return request<ProductResponse>('/commerce/product-drafts', 'POST', input);
}
export function getProduct(id: string): Promise<ProductResponse> {
  return request<ProductResponse>(`/commerce/products/${encodeURIComponent(id)}`);
}
export function listProducts(query: ProductListQuery): Promise<ProductPageResponse> {
  return request<ProductPageResponse>('/commerce/products', 'GET', undefined, queryValues(query));
}
export function listCategories(query: CatalogListQuery = {}): Promise<CategoryResponse[]> {
  return request<CategoryResponse[]>('/commerce/categories', 'GET', undefined, queryValues(query));
}
export function saveProductDraft(
  id: string,
  input: SaveProductDraftRequest,
): Promise<ProductResponse> {
  return request<ProductResponse>(
    `/commerce/product-drafts/${encodeURIComponent(id)}`,
    'PATCH',
    input,
  );
}
export function bindProductDraftMedia(
  id: string,
  input: BindProductDraftMediaRequest,
): Promise<ProductResponse> {
  return request<ProductResponse>(
    `/commerce/product-drafts/${encodeURIComponent(id)}/media`,
    'PATCH',
    input,
  );
}
export function validateProductDraft(id: string): Promise<ProductPublishValidationResponse> {
  return request<ProductPublishValidationResponse>(
    `/commerce/product-drafts/${encodeURIComponent(id)}/publish-validation`,
  );
}
export function publishProductDraft(
  id: string,
  input: PublishProductDraftRequest,
): Promise<PublishProductDraftResponse> {
  return request<PublishProductDraftResponse>(
    `/commerce/product-drafts/${encodeURIComponent(id)}/publish`,
    'POST',
    input,
  );
}

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
        'X-Request-Id': `merchant-product-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        'content-type': 'application/json',
      },
      timeout: 15_000,
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data as T);
        else reject(new MerchantApiError(errorMessage(response.data), response.statusCode));
      },
      fail: (failure) => reject(new MerchantApiError(failure.errMsg || '网络连接失败')),
    });
  });
}

function queryValues(value: object): Record<string, QueryValue> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function errorMessage(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'message' in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '商品服务暂时不可用';
}
