/** 商品视图转换工具单元测试。 */
import type { ProductResponse, ProductVariantResponse } from '@saas/contracts';
import { describe, expect, it } from 'vitest';

import {
  formatCurrency,
  getLowestPrice,
  getPrimaryImage,
  getVariantSpecText,
} from './product-view';

const BASE_PRODUCT: ProductResponse = {
  id: 'product-1',
  code: 'LUX-001',
  name: '测试藏品',
  description: null,
  categoryId: null,
  brandId: null,
  attributes: {},
  seoSlug: null,
  status: 'active',
  version: 0,
  variants: [],
  createdAt: '2026-08-27T00:00:00.000Z',
  updatedAt: '2026-08-27T00:00:00.000Z',
};

describe('product view helpers', () => {
  it('formats currency without converting to floating point', () => {
    expect(formatCurrency('1280000.5')).toBe('¥ 1,280,000.50');
  });

  it('selects the exact lowest decimal price', () => {
    const product = {
      ...BASE_PRODUCT,
      variants: [createVariant('12000.00'), createVariant('9999.99')],
    };
    expect(getLowestPrice(product)).toBe('9999.99');
  });

  it('reads the first image from extension attributes', () => {
    expect(
      getPrimaryImage({ ...BASE_PRODUCT, attributes: { images: ['https://image.test/1'] } }),
    ).toBe('https://image.test/1');
  });

  it('converts primitive specification values to readable text', () => {
    const variant = { ...createVariant('100.00'), specs: { material: '18K金', size: 12 } };
    expect(getVariantSpecText(variant)).toBe('18K金 · 12');
  });
});

function createVariant(price: string): ProductVariantResponse {
  return {
    id: `variant-${price}`,
    sku: `SKU-${price}`,
    specs: {},
    price,
    costPrice: '0.00',
    weightG: null,
  };
}
