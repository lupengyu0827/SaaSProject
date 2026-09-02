/** 小程序商品 API：契约来自 @saas/contracts。 */
import type {
  PublicProductListQuery,
  PublicProductPageResponse,
  PublicProductResponse,
} from '@saas/contracts';

import { getMockProduct, listMockProducts } from '../../mocks/products';
import { requestApi } from '../client';

const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

/** 查询当前租户在售商品。 */
export function listActiveProducts(
  query: PublicProductListQuery,
): Promise<PublicProductPageResponse> {
  if (USE_MOCK_DATA) return Promise.resolve(listMockProducts(query));
  return requestApi<PublicProductPageResponse>({
    path: '/commerce/public/products',
    query: {
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword,
      categoryId: query.categoryId,
      brandId: query.brandId,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    },
  });
}

/** 查询当前租户的单个商品详情。 */
export function getProductDetail(productId: string): Promise<PublicProductResponse> {
  if (USE_MOCK_DATA) {
    const product = getMockProduct(productId);
    return product
      ? Promise.resolve(product)
      : Promise.reject(new Error('没有找到这件藏品，请返回首页重新选择'));
  }
  return requestApi<PublicProductResponse>({
    path: `/commerce/public/products/${encodeURIComponent(productId)}`,
  });
}
