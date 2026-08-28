/** 小程序商品 API：契约来自 @saas/contracts。 */
import type { ProductListQuery, ProductPageResponse, ProductResponse } from '@saas/contracts';

import { getMockProduct, listMockProducts } from '../../mocks/products';
import { requestApi } from '../client';

const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

/** 查询当前租户在售商品。 */
export function listActiveProducts(
  query: Omit<ProductListQuery, 'status'>,
): Promise<ProductPageResponse> {
  if (USE_MOCK_DATA) return Promise.resolve(listMockProducts(query.search));
  return requestApi<ProductPageResponse>({
    path: '/commerce/products',
    query: { ...query, status: 'active' },
  });
}

/** 查询当前租户的单个商品详情。 */
export function getProductDetail(productId: string): Promise<ProductResponse> {
  if (USE_MOCK_DATA) {
    const product = getMockProduct(productId);
    return product
      ? Promise.resolve(product)
      : Promise.reject(new Error('没有找到这件藏品，请返回首页重新选择'));
  }
  return requestApi<ProductResponse>({
    path: `/commerce/products/${encodeURIComponent(productId)}`,
  });
}
