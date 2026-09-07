/** 购物车 API：首期纯前端视觉还原，mock 数据；真实数据源与结算属后端主开发职责。 */
import type { CartResponse } from '@saas/contracts';

import { getMockCart } from '../../mocks/cart';
import { requestApi } from '../client';

const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

/** 读取购物车。 */
export function getCart(): Promise<CartResponse> {
  if (USE_MOCK_DATA) return Promise.resolve(getMockCart());
  // 后端 Cart 接口尚未实现，首期走 mock；后续 F05 链路接入时替换为真实请求。
  return requestApi<CartResponse>({ path: '/commerce/public/cart' });
}
