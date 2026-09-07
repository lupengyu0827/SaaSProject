/** 购物车 Mock：纯前端视觉还原用，数据源与结算逻辑属后端主开发职责。 */
import type { CartResponse } from '@saas/contracts';

/** 演示购物车：两条勾选中的藏品。 */
export const MOCK_CART: CartResponse = {
  items: [
    {
      id: 'cart-item-1',
      productId: 'mock-diamond-ring',
      variantId: 'mock-diamond-ring-default',
      productName: '祖母绿切割钻石铂金戒指',
      seriesLabel: '高级珠宝',
      specsText: '臻品 · 近新',
      imageUrl: '/static/images/mock/diamond-ring.jpg',
      unitPrice: '128000.00',
      originalPrice: '148000.00',
      quantity: 1,
      selected: true,
      lineTotal: '128000.00',
    },
    {
      id: 'cart-item-2',
      productId: 'mock-vintage-watch',
      variantId: 'mock-vintage-watch-default',
      productName: '黄金方形手动上链古董腕表',
      seriesLabel: '典藏腕表',
      specsText: '中古 · 优良',
      imageUrl: '/static/images/mock/vintage-watch.jpg',
      unitPrice: '46500.00',
      originalPrice: '52000.00',
      quantity: 1,
      selected: true,
      lineTotal: '46500.00',
    },
  ],
  summary: {
    selectedCount: 2,
    selectedTotal: '174500.00',
    allSelected: true,
  },
};

export function getMockCart(): CartResponse {
  return MOCK_CART;
}
