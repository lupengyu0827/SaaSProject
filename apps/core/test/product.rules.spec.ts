/** 商品领域规则单元测试：覆盖金额、SKU 唯一性与状态机。 */
import { describe, expect, it } from 'vitest';
import {
  assertCreateProduct,
  assertMoney,
  assertStatusTransition,
} from '../src/commerce/domain/product.rules.js';

describe('product rules', () => {
  it('accepts a complete product with multiple unique variants', () => {
    expect(() =>
      assertCreateProduct({
        code: 'P-1',
        name: 'Vintage Bag',
        variants: [
          { sku: 'P-1-BLK', price: '12800.00' },
          { sku: 'P-1-RED', price: '13800' },
        ],
      }),
    ).not.toThrow();
  });

  it('rejects duplicate sku and invalid money precision', () => {
    expect(() =>
      assertCreateProduct({
        code: 'P-1',
        name: 'Bag',
        variants: [
          { sku: 'SAME', price: '1.00' },
          { sku: 'SAME', price: '2.00' },
        ],
      }),
    ).toThrow(/unique/);
    expect(() => assertMoney('1.001', 'price')).toThrow(/price/);
  });

  it('allows relisting but keeps sold as a terminal state', () => {
    expect(() => assertStatusTransition('active', 'archived')).not.toThrow();
    expect(() => assertStatusTransition('archived', 'active')).not.toThrow();
    expect(() => assertStatusTransition('sold', 'active')).toThrow(/transition/);
    expect(() => assertStatusTransition('draft', 'sold')).toThrow(/transition/);
  });
});
